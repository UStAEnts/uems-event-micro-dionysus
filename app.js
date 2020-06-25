var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var db = require('./event_details_connector.js');

const MONGO_DB_URI = "mongodb://mongo:27017/event-details";

var app = express();

var events;

try {
  events = new db.connect(MONGO_DB_URI);
} catch (err) {
  console.error("Event details microservice failed to connect to database... exiting");
  console.error(err.message);
}


app.set('port', process.env.PORT || 15550);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.post('/', (req, res) => {
  return res.send("Test Path, Post Req Received")
});

app.get('/test_get_events', handle_get_events_request);

app.post('/get_events', handle_get_events_request);

function handle_get_events_request(req, res) {
  var data = await (events.retrieve_all_events());
  console.log(data);

  return res.send(data);
}

module.exports = app;

app.listen(app.get('port'));

console.log("Started event micro dionysus");