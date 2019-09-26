"use strict"
var express = require("express");
var app = express();
var cors = require('cors');
var bodyParser = require('body-parser');
var MongoClient = require("mongodb").MongoClient;
var url = "mongodb://localhost:27017";

app.use(cors());
app.use(express.json());

MongoClient.connect(url, {useNewUrlParser: true , useUnifiedTopology: true}, (err, client) => {
	let db = client.db("Android");

});
app.listen(8888);
console.log("Everything is ok !");

