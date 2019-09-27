#!/bin/bash 
mongoimport --db JdmVitesse --collection mots --file mots.json --drop

mongoimport --db JdmVitesse --collection requetes --file requetes.json --drop