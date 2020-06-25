var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var db = require('./event_details_connector.js');

const MONGO_DB_URI = "mongodb://localhost:27017/events";

var app = express();

var events = new db.EventDetailsConnector(MONGO_DB_URI);

app.set('port', process.env.PORT || 15670);

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

app.listen(app.get('port'))