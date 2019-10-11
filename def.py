# -*-coding:Latin-1 -*
#!/usr/bin/python3.6
import re
import sys
import requests
import json
from bs4 import BeautifulSoup
import urllib.parse

def getMotRelationEntrante(data, mot):
	lignes = data.split("\n");
	e = [];
	r = [];
	for ligne in lignes:
		if re.search("^e;",ligne):
			e.append(ligne);
		if "relations entrantes" in ligne:
			break;
		if re.search("^r;",ligne):
			r.append(ligne);

	poids = 0;
	motCote = ("'"+mot+"'");
	for k in e:
		motCourant = k.split(";");
		if len(motCourant)== 6 :
			if motCourant[5] == motCote:
				poids = motCourant[4];
		else :
			if motCourant[2] == motCote :
				poids = motCourant[4];
	rez = [];
	for i in e:
		for j in r:
			motCourant = i.split(";")
			motCourantDeLaRela =j.split(";")
			if(motCourant[1]==motCourantDeLaRela[3]):
				rez.append(i);
		if(len(rez) == len(r)):
			break;
	rez.append(poids);
	return rez;

def getRamification(mot):
	url = "http://www.jeuxdemots.org/rezo-dump.php?gotermsubmit=Chercher&gotermrel="+urllib.parse.quote_plus(mot, encoding='cp1252')+"&rel=1";
	data = requests.get(url);
	data = BeautifulSoup(data.text, 'html.parser')
	definition = str(data.find("def").text);
	data = str(data.find("code"));
	data = data.replace("&gt;",">");
	dataClear = getMotRelationEntrante(data,mot);
	poidCurrentMot = dataClear.pop();
	if len(dataClear) == 0 :
		rez = {"mot": mot,"definion" : definition, "poid" : int(poidCurrentMot)};
		return rez;
	rez = {"mot": mot,"definion" : definition, "poid" : int(poidCurrentMot), "ramification": []};
	for motAParcourir in dataClear:
		motCourant = motAParcourir.split(";");
		if len(motCourant)== 6 :
			motCourant= motCourant[5][1:(len(motCourant[5])-1)] #on enlève les quote
			rez['ramification'].append(getRamification(motCourant))
		else:
			motCourant= motCourant[2][1:(len(motCourant[2])-1)]
			rez['ramification'].append(getRamification(motCourant))
	return rez;

def debut(mot):
	return json.dumps(getRamification(mot),ensure_ascii=False);


if len(sys.argv) == 1:
	print('Rentrer un mot ! (ex : ./script.py chat)')
else:
	print(debut(sys.argv[1]));
