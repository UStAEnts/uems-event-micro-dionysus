var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const fs = require('fs');

var db = require('./event_details_connector.js');

var app = express();

var events_db = null;

console.log("Starting event micro dionysus...");

app.set('port', process.env.PORT || 15550);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

/*
  If an error is thrown by the given function (which is wrapped in a Promise) then
  it will be handled by passing it to express using next().
*/
const asyncErrorCatcher = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Note that all access points which start with test_ are temporary and will be removed.
// They are used to allow easily triggering actions by navigating to a page in the browser.
app.get('/test_get_events', asyncErrorCatcher(async (req, res, next) => {
  events_db.retrieve_all_events().then(function(data) {
    console.log(data);
    res.json(data);
  });
}));

app.post('/', (req, res) => {
  return res.send("Test Path, Post Req Received")
});

// Start of the mongoDB connection. 
// The connection info (including username / password) is read from configuration file.
fs.readFile("database.json", function(err, data) {
  if (err) {
    console.error("Failed to read database.json file... database connection failed...");
    return;
  }

  console.log("Database.json file opened successfully...");

  const db_info = JSON.parse(data);

  try {
    db.setup(db_info.uri).then(database_connection_ready);
  } catch (err) {
    console.error("Event details microservice failed to connect to database... exiting");
    console.error(err.message);
  }
});

// Called once the database connection is ready.
function database_connection_ready(events_conn) {
  console.log("Database connection ready");

  events_db = events_conn;

  app.listen(app.get('port'));

  console.log("Started event micro dionysus");
}

module.exports = app;