## Database configuration


Pretzel now uses (since branch feature/progressive) aggregation pipeline queries in mongoDb, which are available in mongoDb versions after 4.

Progressive loading of paths via aliases relies on the indices of the Alias collection, and indexes are added to the Feature collection also :

```
mongo --quiet admin
db.Feature.getIndexes()
db.Feature.createIndex({blockId:1, value_0:1})
db.Feature.createIndex({blockId:1} )

db.Alias.getIndexes()
db.Alias.createIndex ( {namespace1:1} )
db.Alias.createIndex ( {namespace2:1} )
db.Alias.createIndex ( {string1:1} )
db.Alias.createIndex ( {string2:1} )

db.Alias.createIndex ( {namespace1:1, namespace2:1} )
db.Alias.createIndex ( {string1:1, string2:1} )

exit
```
This is applicable to any of the build methods.
This assumes DB_NAME=admin;  substituted e.g. pretzel for admin.

To check if these aliases are already added :
```
db.Feature.getIndexes()
db.Alias.getIndexes()
```



### Pretzel 2.7 update

From v2.7, Pretzel has support for an added index on the Feature database which improves performance.
There are corresponding changes in the Pretzel server which are enabled by setting use_value_0=1 in the server environment.

Also these db indexes are added to the recommendation :
```
  db.Alias.createIndex ( {namespace1:1, namespace2:1, string1:1, string2:1} )
  db.Feature.createIndex({blockId:1, value_0:1})
  db.Feature.createIndex({name:1} )
```
The above index for Alias can replace all the earlier Alias indexes.

To update existing Features to add the .value_0 field used by the above index :
```
db.Feature.updateMany({value : { $type: [ "array" ]} },
[ {$set : {value_0 : {$arrayElemAt: [ "$value", 0 ] } }}] )
```

For upgrades from early versions of Pretzel, first handle Features with value fields which are no longer standard :

This will handle Features with .range which is an array [start] or [start,end], instead of .value
```
db.Feature.updateOne({range : { $type: [ "array" ]}, value : {$exists : false}},
[ {$set : {value_0 : {$arrayElemAt: [ "$range", 0 ] } }}] )
```

To check if that is required :
```
db.Feature.find({range : { $type: [ "array" ]} })
```


This will handle Features with .value which is a single number instead of [start] or [start,end]
```
db.Feature.updateMany({ value: { $not : { $type: [ "array" ]} , $type: [ "number" ] } },
 [ {$set : {value_0 : "$value" }}])
```
To check if that is required :
```
db.Feature.find({ value: { $not : { $type: [ "array" ]} , $type: [ "number" ] } })
```


This handles Features which are in the current (v2) format, i.e. .value is [start] or [start,end].
This is all that is required for installations which don't have datasets from earlier versions.
```
db.Feature.updateMany({ value_0 : {$exists : false}, value: { $type: [ "array" ]} } ,
 [ {$set : {value_0 : {$arrayElemAt: [ "$value", 0 ] } }}] )
```


Check that all Features now have .value_0
```
db.Feature.find({ value_0 : {$exists : false}} )
```

As noted above, create the index which uses Feature.value_0
```
db.Feature.createIndex({blockId:1, value_0:1})
```
This replaces the Feature index with partialFilterExpression, which is no longer required.

Then enable the use of this in the server:
`export use_value_0=1`
