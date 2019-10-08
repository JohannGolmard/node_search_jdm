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

function getMotRelationEntrante(data){
	let lignes = data.split("\n");
	let e = [];
	let r = [];
	for(let ligne in lignes){
		if(lignes[ligne].match(/^e;/) != null)
			e.push(lignes[ligne]);
		if(lignes[ligne].includes("relations entrantes"))
			break;
		if(lignes[ligne].match(/^r;/) != null)
			r.push(lignes[ligne]);
	}

	let rez= [];
	for (var i = 0; i < e.length; i++) {
		for (var j = 0; j < r.length; j++) {
			let motCourant = e[i].split(";")
			let motCourantDeLaRela = r[j].split(";")
			if(motCourant[1]==motCourantDeLaRela[3])
				rez.push(e[i]);
		}

		if(rez.length == r.length)
			break;
	}

	return rez;
}

function ramif(mot, motAlreadyGet){
	console.log(mot)
	http.get('http://www.jeuxdemots.org/rezo-dump.php?gotermsubmit=Chercher&gotermrel='+mot+'&rel=1', (resp) => {
		// JDM go utf-8 la prochaine fois :)
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
		let definition = $('def').text();
		let dataClear = getMotRelationEntrante(data);
		let end = true;
		let poid;
		//toutes les définitions trouvé par les mots 
		for (var i = 0; i < dataClear.length; i++) {
			let motCourant = dataClear[i].split(";")
			if(!motAlreadyGet.includes(motCourant[2])){
				end = false;
			}
			let mot_tempo= "'"+mot+"'";
			if(motCourant[2]==mot_tempo){
				poid = motCourant[4]
			}		
		}
		if(end){
			let def = {'definition' : definition, 'poids':poid};
			return def;
		}
		let def = {'definition' : definition, 'poids':poid, 'ramification':[]};
		let resRamif;
		for (var j = 0; j < dataClear.length; j++) {
			let motCourant = dataClear[j].split(";")
			if(!motAlreadyGet.includes(motCourant[2])){
				motAlreadyGet.push(motCourant[2]);
				if(motCourant[5]!=undefined){
					//suppression des ''
					motCourant[5]=motCourant[5].substring(motCourant[5].length-1, 1);
					resRamif = ramif(motCourant[5],motAlreadyGet);
					def.ramification.push(resRamif);
				}
				else{
					//suppression des ''
					motCourant[2]=motCourant[2].substring(motCourant[2].length-1, 1);
					resRamif = ramif(motCourant[2],motAlreadyGet);
					def.ramification.push(resRamif);
				}

			}
		}
		return def;
	});

	}).on("error", (err) => {
	  console.log("Error ramification : " + err.message);
	});
}

function getRamification(mot, callback){
	let motAlreadyGet = new Array();
	let mot_tempo= "'"+mot+"'";
	let promises = [];
	motAlreadyGet.push(mot_tempo);
	let rez = ramif(mot, motAlreadyGet);
	console.log("qsdsqdsqdsq")
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



	app.get("/requetes/:mot/:arrayRela", (req, res)=>{
		let mot = req.params.mot;
		let tempo = req.params.arrayRela.split(',');
		let rela = tempo.map(function (x) { 
  			return parseInt(x, 10); 
		});
		console.log(rela);
		res.setHeader("Content-type", "application/json");
		res.end(JSON.stringify(rela));
	})

	// Définition si elle y est tant mieux sinon avec les rafinements (relation 4 )
	app.get("/requete/:mot/:numRela",(req,res)=>{
		let mot = req.params.mot;
		let numRela = parseInt(req.params.numRela);
		let dateObject = new Date();
		let date = dateObject.getDate()+"/"+(dateObject.getMonth()+1)+"/"+dateObject.getFullYear()
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
    					db.collection("requetes").insertOne({"mot":mot,"numRela":numRela,"definition":"TO DO","data":dataClear,"date":date,"nb_access":1},(err,documents)=>{
							res.setHeader("Content-type", "application/json");
    						res.end(JSON.stringify(documents['ops'][0])); //pour éviter de récupérer le tableau mais juste les info
						});

						/*let ramification = getRamification(mot, (ramification)=>{
								res.setHeader("Content-type", "application/json");
		    					res.end(JSON.stringify(ramification));
		    					/*db.collection("requetes").insertOne({"mot":mot,"numRela":numRela,"definition":ramification,"data":dataClear,"date":date,"nb_access":1},(err,documents)=>{
									res.setHeader("Content-type", "application/json");
		    						res.end(JSON.stringify(documents['ops'][0])); //pour éviter de récupérer le tableau mais juste les info
								});

						});*/
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
