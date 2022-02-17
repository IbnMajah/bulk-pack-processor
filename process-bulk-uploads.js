require("dotenv").config();
const {
  connectionString,
  dataInputMicroserviceURI,
  dataInputMicroserviceURIV2,
} = require("./config/config");
const rp = require("request-promise-native");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString,
});
//const Sentry = require('@sentry/node');
//Sentry.init({ dsn: Config.sentryDSN });

const v2MicroserviceURIV1Endpoints = dataInputMicroserviceURIV2 + "v1/";
const v1MicroserviceURIV2Endpoints = dataInputMicroserviceURI + "v2/";

const v2Requests = async (data, endpoint, v2Only) => {
  const optionsV2 = {
    method: "POST",
    uri: dataInputMicroserviceURIV2 + endpoint,
    body: data,
    json: true, // Automatically stringifies the body to JSON
  };

  const optionsV1 = {
    ...optionsV2,
    uri: v1MicroserviceURIV2Endpoints + endpoint,
  };

  // send data to both v1 and v2
  await rp(optionsV2);
  if (!v2Only) {
    await rp(optionsV1);
  }
};

const v1Requests = async (data, endpoint, httpVerb) => {
  const optionsV1 = {
    method: httpVerb || "POST",
    uri: dataInputMicroserviceURI + endpoint,
    body: data,
    json: true, // Automatically stringifies the body to JSON
  };

  const optionsV2 = {
    ...optionsV1,
    method: httpVerb || "POST",
    uri: v2MicroserviceURIV1Endpoints + endpoint,
  };

  // send data to both v1 and v2
  await rp(optionsV2);
  await rp(optionsV1);
};

(async () => {
  const query = {
    text: `SELECT *
    FROM bulk_tree_upload
    WHERE processed = FALSE`,
  };
  const rval = await pool.query(query);

  outerLoop:
  for (let row of rval.rows) {
    console.log(row.id);
    const bulkData = row.bulk_data;

    if (bulkData.pack_format_version === "2") {
      console.log("bulk pack format version 2 detected");
      // Version 2
      const wallet_registrations = bulkData.wallet_registrations;
      const device_configurations = bulkData.device_configurations;
      const sessions = bulkData.sessions;
      const captures = bulkData.captures;
      const messages = bulkData.messages;
      if (wallet_registrations?.length) {
        console.log("processing v2 wallet_registrations");
        for (const wallet_registration of wallet_registrations) {
          try {
            await v2Requests(wallet_registration, "wallet_registrations");
          } catch (e) {
            console.log(e);
            continue outerLoop;
          }
        }
        console.log("v2 wallet_registrations done");
      }

      if (device_configurations?.length) {
        console.log("processing v2 device_configurations");
        for (const device_configuration of device_configurations) {
          try {
            await v2Requests(device_configuration, "device_configurations");
          } catch (e) {
            console.log(e);
            continue outerLoop;
          }
        }
        console.log("v2 device_configurations done");
      }

      if (sessions?.length) {
        console.log("processing v2 sessions");
        for (const session of sessions) {
          try {
            await v2Requests(session, "sessions", true);
          } catch (e) {
            console.log(e);
            continue outerLoop;
          }
        }
        console.log("v2 sessions done");
      }

      if (captures?.length) {
        console.log("processing v2 captures");
        for (const capture of captures) {
          try {
            await v2Requests(capture, "captures");
          } catch (e) {
            console.log(e);
            continue outerLoop;
          }
        }
        console.log("v2 captures done");
      }

      if (messages?.length) {
        console.log("v2 messages");
        for (const message of messages) {
          try {
            await v2Requests(message, "messages", true);
          } catch (e) {
            console.log(e);
            continue outerLoop;
          }
        }
        console.log("v2 messages done");
      }
    } else {
      // Version 1
      console.log("bulk pack format version 1 detected");
      if (bulkData.registrations?.length) {
        console.log("processing v1 registrations");
        for (let planter of bulkData.registrations) {
          try {
            await v1Requests(planter, "planter");
          } catch (e) {
            console.log(e);
            continue outerLoop;
          }
        }
        console.log("v1 registrations done");
      }

      if (bulkData.devices?.length) {
        console.log("processing v1 devices");
        for (let device of bulkData.devices) {
          try {
            await v1Requests(device, "device", "PUT");
          } catch (e) {
            console.log(e);
            continue outerLoop;
          }
        }
        console.log("v1 devices done");
      }

      if (bulkData.trees?.length) {
        console.log("processing v1 trees");
        for (let tree of bulkData.trees) {
          try {
            await v1Requests(tree, "tree");
          } catch (e) {
            console.log("tree requests failed");
            console.log(e.message);
            continue outerLoop;
          }
        }
        console.log("v1 trees done");
      }
    }

    const update = {
      text: `UPDATE bulk_tree_upload
      SET processed = TRUE,
      processed_at = now()
      WHERE id = $1`,
      values: [row.id],
    };
    console.log("update");
    await pool.query(update);
    console.log(`Processed bulk tree upload ${row.id}`);
  }
  console.log("done");
  pool.end();
  process.exit(0);
})().catch((e) => {
  console.log(e);
  //Sentry.captureException(e);
  pool.end();

  console.log("notify-slack-reports done with catch");
  process.exit(1);
});
