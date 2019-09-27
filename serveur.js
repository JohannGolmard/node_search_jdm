"use strict"
var htmlParser = require('cheerio');
var express = require("express");
var app = express();
var cors = require('cors');
var bodyParser = require('body-parser');
var MongoClient = require("mongodb").MongoClient;
var http = require('http');
var url = "mongodb://localhost:27017";

app.use(cors());
app.use(express.json());

function clearData(data){
	let lignes = data.split("\n");
	let rez = [];
	for(let ligne in lignes){
		if(lignes[ligne].match(/^e;/) != null)
			rez.push(lignes[ligne]);
	}
	return rez;
}

MongoClient.connect(url, {useNewUrlParser: true , useUnifiedTopology: true}, (err, client) => {
	let db = client.db("JdmVitesse");

	app.get("/mots/:mot",(req,res)=>{
		let mot = req.params.mot;
		db.collection("mots").find({"mot":mot}).toArray((err,documents)=>{
			res.setHeader("Content-type", "application/json");
		    res.end(JSON.stringify(documents));
		});
	});

	// sort tous mots suivant le mot passé en paramètre (^mot%) dans l'ordre décroissant du poid
	app.get("/completion/:mot",(req,res)=>{
		let mot = req.params.mot;
		db.collection("mots").find({"mot":new RegExp('^'+mot,'i')}).sort({ poid: -1 }).toArray((err,documents)=>{
			res.setHeader("Content-type", "application/json");
		    res.end(JSON.stringify(documents));
		});
	});



	app.get("/requete/:mot/:numRela",(req,res)=>{
		let mot = req.params.mot;
		let numRela = parseInt(req.params.numRela);
		let dateObject = new Date();
		let date = dateObject.getDate()+"/"+(dateObject.getMonth()+1)+"/"+dateObject.getFullYear()
		db.collection("requetes").find({"mot":mot, "numRela":numRela}).toArray((err,documents)=>{
			//on requête JDM et on l'ajoute à la BDD + renvoi du tout
			if(documents.length == 0){
				http.get('http://www.jeuxdemots.org/rezo-dump.php?gotermsubmit=Chercher&gotermrel='+mot+'&rel='+numRela+'', (resp) => {
  					let data = '';

					// A chunk of data has been recieved.
					resp.on('data', (chunk) => {
						data += chunk;
					});

					// The whole response has been received. Print out the result.
					resp.on('end', () => {
						const $ = htmlParser.load(data);
						data=$('code').text();
						let dataClear = clearData(data)
						db.collection("requetes").insertOne({"mot":mot,"numRela":numRela,"data":dataClear,"date":date,"nb_access":1},(err,documents)=>{
							res.setHeader("Content-type", "application/json");
		    				res.end(JSON.stringify(documents['ops'][0])); //pour éviter de récupérer le tableau mais juste les info
						});
					});

					}).on("error", (err) => {
					  console.log("Error lors de l'ajout d'un mot à la BDD : " + err.message);
				});
			}else{ // mets à jour la date et le nbAccess
				db.collection("requetes").findOneAndUpdate({"mot":mot, "numRela":numRela},{$set: {"nb_access":documents[0].nb_access+1, "date":date}},{returnOriginal: false}, (err,documents)=>{
					res.setHeader("Content-type", "application/json");
		    		res.end(JSON.stringify(documents['value']));
				});

			}
		});
	});

});
app.listen(8888);
console.log("Everything is ok !");
