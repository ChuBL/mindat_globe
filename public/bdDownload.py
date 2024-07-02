#This is the file to run in order to get the needed database file for the query
#This takes a while 

import json
import sqlite3;
import openmindat
gr = openmindat.GeomaterialRetriever()
lr = openmindat.LocalitiesRetriever()
lidr = openmindat.LocalitiesIdRetriever()


file = "MindatSql.db"
important_fields = "id,txt,description_short,elements,links"

#Running the mindat queries to get needed data
rawdata = lr.fields(important_fields).get_dict()
MindatPartial = lr.fields('id,longitude,latitude').get_dict()
 

#This connects to or creates the needed database file
def createSql(FILEPATH):
    try: 
        conn = sqlite3.connect(FILEPATH) 
        print("Database Sqlite3.db formed.") 
    except: 
        print("Database Sqlite3.db not formed.")
        
    return conn
  
#This takes the data from the Mindat query and populates the database
#CONNECTION is what you need to put in from the createsql return
#dataset should be the mindat query
#TABLENAME is the name you want the table to be. 
#   ~'MindatPartial' for the table of datapoints
#   ~'MindatFull' for the table of id descriptions
#dataset fields is for what fields there are, example for mindatPartial, id, latitude, longitude
#   ~Order matters
#number of fields, for example, there are 3 fields with mindatpartial
def populateSql(CONNECTION, dataset, TABLENAME, datasetFields, numberOfFields):
    
    #creates the commands which will be used
    questionMarkCount = '?'
    for i in range(numberOfFields - 1):
        questionMarkCount = questionMarkCount + ', ?'
    connection = CONNECTION
    dropCommand = "DROP TABLE IF EXISTS " + TABLENAME
    createCommand = "CREATE TABLE " + TABLENAME + datasetFields
    insertCommand = "INSERT INTO " + TABLENAME + " VALUES("+ questionMarkCount +")"
    
    try: 
        # Making a connection between sqlite3 database and Python Program 
        cur = connection.cursor()
        cur.execute(dropCommand)
        cur.execute(createCommand)

        #actual logic for populating database
        for item in dataset:
            dataValues = [*item.values()]
            cur.execute(insertCommand, dataValues)

            connection.commit()

    except sqlite3.Error as error: 
        print("Failed to connect with sqlite3 database", error) 
    finally: 
        # Inside Finally Block, If connection is open, we need to close it 
        if connection: 
            # using close() method, we will close the connection 
            connection.close() 
            # After closing connection object, we will print "the sqlite connection is closed" 
            print("the sqlite connection is closed")


#commands to run
#The order of arguments in these are very important
conn = createSql(file)
populateSql(conn, MindatPartial['results'], 'MindatPartial', '(id, latitude, longitude)', 3)
conn = createSql(file)
populateSql(conn, rawdata['results'], 'MindatFull', '(id, txt, description_short, elements, links)', 5)