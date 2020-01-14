"use strict"
var htmlParser = require('cheerio');
var express = require("express");
var app = express();
var cors = require('cors');
var MongoClient = require("mongodb").MongoClient;
var http = require('http');
var spawn = require('child_process').spawn;
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

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function getRamification(mot, callback){
	//On appel le script python !
	const ls = spawn('python3', ['def.py', mot]);

	ls.stdout.on('data', (data) => {
  	callback(JSON.parse(data));
	});

	ls.stderr.on('data', (data) => {
	  console.error(`stderr: ${data}`);
	});

	ls.on('close', (code) => {
	  //console.log(`child process exited with code ${code}`);
	});
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

	app.post("/addMots",(req,res)=>{
		let mot = req.body['mot'];
		try {
				db.collection("mots").find({"mot":mot}).toArray((err,documents)=>{
					if(documents.length!=0){
		    		res.end(JSON.stringify('Membre existe déjà !'));
		    	}
		    	else{
		    	  db.collection("mots").insertOne(req.body);
				    res.end(JSON.stringify("Inscription réussie"));
		    	}
				});
		} catch(e) {
	  	console.log(e);
	  }
	});

	// sort tous mots suivant le mot passé en paramètre (^mot%) dans l'ordre décroissant du poid
	app.get("/completion/:mot",(req,res)=>{
		let mot = req.params.mot;
		db.collection("mots").find({"mot":new RegExp('^'+escapeRegExp(mot),'i')}).sort({ poid: -1 }).toArray((err,documents)=>{
			res.setHeader("Content-type", "application/json");
		    res.end(JSON.stringify(documents));
		});
	});


	// séparé avec des virgules
	app.get("/requetes/:mot/:arrayRela", (req, res)=>{
		let mot = req.params.mot;
		let tempo = req.params.arrayRela.split(',');
		let rela = tempo.map(function (x) {
  			return parseInt(x, 10);
		});

		var promises = [];
		for(let rez in rela){
			let numRela = rela[rez];
			promises.push(new Promise((resolve, reject) => {
				db.collection("requetes").find({"mot":mot, "numRela":numRela}).toArray((err,documents)=>{
					let dateObject = new Date();
					let date = dateObject.getDate()+"/"+(dateObject.getMonth()+1)+"/"+dateObject.getFullYear();
					//on requête JDM et on l'ajoute à la BDD + renvoi du tout
					if(documents.length == 0){
						http.get('http://www.jeuxdemots.org/rezo-dump.php?gotermsubmit=Chercher&gotermrel='+mot+'&rel='+numRela+'', (resp) => {
		  					resp.setEncoding('latin1');
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
											resolve(JSON.stringify(documents['ops'][0]));
								});
							});

							}).on("error", (err) => {
							  console.log("Error lors de l'ajout d'un mot à la BDD : " + err.message);
						});
					}else{ // mets à jour la date et le nbAccess
						db.collection("requetes").findOneAndUpdate({"mot":mot, "numRela":numRela},{$set: {"nb_access":documents[0].nb_access+1, "date":date}},{returnOriginal: false}, (err,documents)=>{
								resolve(JSON.stringify(documents['value']));
						});

					}
				})
    	}));
		};

		Promise.all(promises).then((rez) =>
    	{
						console.log(rez);
						res.setHeader("Content-type", "application/json");
						res.end(JSON.stringify(rez));
			}
		);
	})

	app.get("/requete/:mot/:numRela",(req,res)=>{
		let mot = req.params.mot;
		let numRela = parseInt(req.params.numRela);
		let dateObject = new Date();
		let date = dateObject.getDate()+"/"+(dateObject.getMonth()+1)+"/"+dateObject.getFullYear();
		db.collection("requetes").find({"mot":mot, "numRela":numRela}).toArray((err,documents)=>{
			//on requête JDM et on l'ajoute à la BDD + renvoi du tout
			if(documents.length == 0){
				http.get('http://www.jeuxdemots.org/rezo-dump.php?gotermsubmit=Chercher&gotermrel='+mot+'&rel='+numRela+'', (resp) => {
  					resp.setEncoding('latin1');
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


	app.get("/def/:mot",(req,res)=>{
		let mot = req.params.mot;
		let numRela = 1;
		let dateObject = new Date();
		let date = dateObject.getDate()+"/"+(dateObject.getMonth()+1)+"/"+dateObject.getFullYear()
		db.collection("definition").find({"mot":mot}).toArray((err,documents)=>{
			//on requête JDM et on l'ajoute à la BDD + renvoi du tout
			if(documents.length == 0){
				http.get('http://www.jeuxdemots.org/rezo-dump.php?gotermsubmit=Chercher&gotermrel='+mot+'&rel='+numRela+'', (resp) => {
						resp.setEncoding('latin1');
						let data = '';

					// A chunk of data has been recieved.
					resp.on('data', (chunk) => {
						data += chunk;
					});

					// The whole response has been received. Print out the result.
					resp.on('end', () => {
						const $ = htmlParser.load(data);
						data=$('code').text();
						let dataClear = clearData(data);
						let definition =$('def').text();
						db.collection("definition").insertOne({"mot":mot,"definition":definition,"numRela":numRela,"ramification":dataClear},(err,documents)=>{
									res.setHeader("Content-type", "application/json");
									res.end(JSON.stringify(documents['ops']));
						});
					});

					}).on("error", (err) => {
						console.log("Error lors de l'ajout d'un mot à la BDD : " + err.message);
				});
			}else{ // mets à jour la date et le nbAccess
				res.setHeader("Content-type", "application/json");
				res.end(JSON.stringify(documents));
			}
		});
	});

	// test ramification
	app.get("/ramification/:mot",(req,res)=>{
		let mot = req.params.mot;
		let dateObject = new Date();
		let date = dateObject.getDate()+"/"+(dateObject.getMonth()+1)+"/"+dateObject.getFullYear()
		db.collection("definition").find({"mot":mot}).toArray((err,documents)=>{
			//on requête JDM et on l'ajoute à la BDD + renvoi du tout
			if(documents.length == 0){
					getRamification(mot, (ramification)=>{
    					db.collection("definition").insertOne(ramification,(err,documents)=>{
								res.setHeader("Content-type", "application/json");
    						res.end(JSON.stringify(documents['ops']));
							});
					});
			}else{ // mets à jour la date et le nbAccess
						res.setHeader("Content-type", "application/json");
		    		res.end(JSON.stringify(documents));
			}
		});
	});

});
//app.use(express.static(path.join(__dirname,"dist/search-jdm")));
//app.get("*",function(req,res){
//	res.sendFile(path.join(__dirname,"dist/search-jdm/index.html"));
//});
//app.listen(8888);
app.listen(8888, "0.0.0.0");
console.log("Everything is ok !");
