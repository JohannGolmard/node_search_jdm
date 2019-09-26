#!/usr/bin/python3.6
import re

import sys
import pandas as pa
from bs4 import BeautifulSoup
import requests

from selenium import webdriver
from selenium.webdriver.firefox.options import Options

from pymongo import MongoClient

def sitedown(url):
	r = s.get(url)
	if r.status_code != 200:
		print('status_code : ', r.status_code)
	else:
		driver.get(url)
		return BeautifulSoup(driver.page_source, 'html.parser') 


def requete(url, reponse):
	print("URL :", url)
	if not reponse:
		print('Pas de reponse du site:', url)
		driver.close()
		return
	info = reponse.find("code").text
	lignes = info.split("\n")
	all_mots_bdd=[]
	all_poids_bdd=[]
	for line in lignes:
		if re.search("^e;",line):
			split = line.split(";")
			if len(split) == 6 or len(split) == 5:
				if len(split) == 6:
					all_mots_bdd.append(split[5].replace('\'',''))
				else:
					all_mots_bdd.append(split[2].replace('\'',''))
				all_poids_bdd.append(split[4].replace('\'',''))
	putInBdd(all_mots_bdd,all_poids_bdd)

def putInBdd(mots, poids):
	client = MongoClient (port = 27017)
	db = client.JdmVitesse
	for mot, poid in zip(mots, poids):
		add = {
        'mot': mot,
        'poid': int(poid)
		}
		rez = db.mots.find_one({'mot':mot})
		if rez == None:
			db.mots.insert_one(add)

if len(sys.argv) == 1:
	print('Rentrer un mot ! (ex : ./script.py chat)')
else:
	try:
		options = Options()
		#Evite que le navigateur firefox s'ouvre
		options.add_argument('--headless')
		driver = webdriver.Firefox(options=options)
		mot = sys.argv[1]
		# rel=0 pour éviter des phrases et des string bizarre (ex : a64efbf7283dfc58db2cf20f1b78216b)
		site = "http://www.jeuxdemots.org/rezo-dump.php?gotermsubmit=Chercher&gotermrel=chat&rel=?gotermsubmit=Chercher&gotermrel="+mot+"&rel=0"
		s = requests.Session()
		requete(site,sitedown(site))
	except:
		print("Unexpected error:", sys.exc_info()[0])
	driver.quit()