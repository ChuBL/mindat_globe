#This is the file to run in order to get the needed json files for the pr0gram
#This will take a while to execute, expect just under 30 min

#imports 
import json
import openmindat
gr = openmindat.GeomaterialRetriever()
lr = openmindat.LocalitiesRetriever()

#important fields are the data fields to be included when viewing a specific datapoint.
fullDataFields = "id,txt,description_short,elements,links"
partialDataFields = 'id,longitude,latitude'


#Running the mindat queries to get needed data
#if the query fails but Mindat_data_partial ran correctly you can comment out to save time
lnglatData = lr.fields(partialDataFields).get_dict()

#filters the data to remove entries without valid longitude and latitudes
validIds = []
filteredData = {'results': []}
for x in lnglatData['results']:
    if x['longitude'] != 0 and x['latitude'] != 0:
        #x['elements'] = x['elements'][1:-1].split('-') #only needed if elements field is included
        filteredData['results'].append(x)
        validIds.append(x['id'])

#downloads data to current directory
with open('public/Mindat_data_partial.json', 'w+') as f:
    json.dump(filteredData, f, indent=4) 
    f.close()
  
#For when you only want mindat partial  
exit()

#numDataset dictates how many final sets of data there will be. 
#There needs to be a good balance between not having too many data sets and not having too many items per set
#experiment later to see if time can be cut down based on numDataset.
rawdata = lr.fields(fullDataFields).get_dict()
numDataset = 5

#initializes the datasets.
datadict = {}
for i in range(numDataset):
    datadict[str(i)] = {'results': []}

#Gets the rough number of items in the rawdata set, will not be perfect since some id's are skipped.
#This is better than using len because of the logic for the next step.
dataRange = rawdata['results'][-1]['id']

#seperates the data into seperate dictionaries evenlyish. 
#scales with # of datsets.
if numDataset > 1:
    for item in rawdata['results']:
        id = item['id'] 
        if id in validIds: #filters out non valid long/lat combos
            for i in range(numDataset):
                #min and max create ratios based off of the amount of numDataset.
                #ex, if numDataset is 4, and i = 1: max = (1+1)/4 = .5 and min = 1/4 = .25
                #if numDataset = 6 and i = 0: max = 1/6 =~ .167 and min = 0/6 = 0
                min = i/numDataset 
                max = (i+1)/numDataset
                if (id/dataRange) <= max and (id/dataRange) > min:
                    datadict[str(i)]['results'].append(item)
                    break
            else:
                raise ValueError("Value does not fall within given range")
else:
    datadict['0']['results'] = [x for x in rawdata['results'] if x['longitude'] != 0 and x['latitude'] != 0]
    

    # id = item['id']
    # if id/dataRange <= .25 and id/dataRange > 0:
    #     datadict['0']['results'].append(item)
    # elif id/dataRange <= .5 and id/dataRange > .25:
    #     datadict['1']['results'].append(item)
    # elif id/dataRange <= .75 and id/dataRange > .5:
    #     datadict['2']['results'].append(item)
    # elif id/dataRange <= 1 and id/dataRange > .75:
    #     datadict['3']['results'].append(item)

        
#saves the data into same number of files as there are numDataset. 
for i in range(numDataset):
    min = datadict[str(i)]['results'][0]['id']
    max = datadict[str(i)]['results'][-1]['id']
    path = "public/Mindat_Localities_" + str(i) +".json"
    #includes an extra dict key to include range of the datafield
    datadict[str(i)]['range'] = {'min': datadict[str(i)]['results'][0]['id'], 'max': datadict[str(i)]['results'][-1]['id']}
    if i+1 < numDataset:
        datadict[str(i)]['next'] = 'Mindat_Localities_' + str((i+1)) + ".json"
    with open(path, 'w') as f:
        json.dump(datadict[str(i)], f, indent=4) 
        f.close()
        
