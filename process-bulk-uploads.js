require('dotenv').config();
const Config = require('./config/config');
const http = require('http');
const rp = require('request-promise-native');
const { Pool, Client } = require('pg');

const pool = new Pool({
  connectionString: Config.connectionString
});
//const Sentry = require('@sentry/node');
//Sentry.init({ dsn: Config.sentryDSN });


(async () => {
  const query = {
    text: `SELECT *
    FROM bulk_tree_upload
    WHERE processed = FALSE`
  };
  const rval = await pool.query(query);
  for(let row of rval.rows){
    console.log(row.id);
    const bulkData = row.bulk_data;
    var requests = [];
    if(bulkData.registrations != null){

      for(let planter of bulkData.registrations){

        var options = {
          method: 'POST',
          uri: Config.dataInputMicroserviceURI + "planter",
          body: planter,
          json: true // Automatically stringifies the body to JSON
        };

        const promise = rp(options);
        requests.push(promise);
      
      }
    }

    try {
      const result1 = await Promise.all(requests);
      console.log(result1);
    } catch (e)  {
      console.log(e)
      continue;
    }
    requests = []


    if(bulkData.devices != null){

      for(let device of bulkData.devices){
        console.log('device');
      //  console.log(device);

        var options = {
          method: 'PUT',
          uri: Config.dataInputMicroserviceURI + "device",
          body: device,
          json: true // Automatically stringifies the body to JSON
        };

        const promise = rp(options);
        requests.push(promise);
      
      }

    }


    try {
      console.log('put devices');
      const result2 = await Promise.all(requests);
      //console.log(result2);
    } catch (e) {
      console.log(e)
      continue;
    }
    requests = []


    if(bulkData.trees != null){
      for(let tree of bulkData.trees){
        console.log('tree');
        //console.log(tree);

        var options = {
          method: 'POST',
          uri: Config.dataInputMicroserviceURI + "tree",
          body: tree,
          json: true // Automatically stringifies the body to JSON
        };

        const promise = rp(options);
        requests.push(promise);
      
      }

    }


    try {
      console.log('put trees');
      const result3 = await Promise.all(requests);
      //console.log(result3);
    } catch (e) {
      console.log('some tree requests failed')
      console.log(e.message)
      continue;
    }
    requests = []


    const update = {
      text: `UPDATE bulk_tree_upload
      SET processed = TRUE,
      processed_at = now()
      WHERE id = $1`,
      values: [row.id]
    };
    console.log('update');
    const rvalUpdate = await pool.query(update);
    console.log(`Processed bulk tree upload ${row.id}`);

  }
  console.log("done");
  pool.end();
  process.exit(0);

})().catch(e => {
  console.log(e);
  //Sentry.captureException(e);
  pool.end();

  console.log('notify-slack-reports done with catch');
  process.exit(1);
})
