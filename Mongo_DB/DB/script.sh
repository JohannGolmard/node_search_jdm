#!/bin/bash 
mongoimport --db JdmVitesse --collection mots --file mots.json --drop

mongoimport --db JdmVitesse --collection requetes --file requetes.json --drop

mongoimport --db JdmVitesse --collection definition --file definition.json --drop