var express = require('express');
var mongodb = require('mongodb');

run = function(client) {
  var app = express.createServer();
  
  app.register( '.ejs', require('ejs') );
  app.use( express.static(__dirname + '/public') );
  app.use( express.bodyParser() );
  app.use( express.cookieParser() );
  app.use( app.router );
  
  app.get('/',function(req,res){
    var surveys = new mongodb.Collection(client, 'surveys');
    surveys.find( {}, {} ).sort({id:-1}).limit(20).toArray( function(err,docs) {
      /* FIXME handle error */
      if ( err ) { console.log("surveys.find() error:" + err); }
      res.render( 'index.ejs', { surveys: docs } );
    });
  });
  app.post('/survey',function(req,res){
    /* strip leading and trailing spaces, and collapse multiple spaces
       and then break into an array */
    choices = req.body.choices.replace(/(^\s*)|(\s*$)/g,'').replace(/\s{2,}/g,' ').split(' ');
    var surveys = new mongodb.Collection(client,'surveys');
    var survey = { name: req.body.name, choices: choices };
    surveys.insert( survey, function(err,objects) {
      /* FIXME handle error */
      if ( err ) { console.log("suveys.insert() error:" + err); }
      res.redirect("/");
    });
  });
  app.get('/respond/:id',function(req,res){
    var surveys = new mongodb.Collection(client,'surveys');
    var id = new client.bson_serializer.ObjectID(req.params.id);
    surveys.findOne( { _id: id }, function(err,doc) {
      /* FIXME handle error */
      if ( err ) { console.log(err); }
      res.render('respond.ejs', { survey: doc } );
    });
  });
  app.post('/respond/:id',function(req,res){
    var responses = new mongodb.Collection(client,'responses');
    var survey_id = new client.bson_serializer.ObjectID(req.params.id);
    var response = { survey_id: survey_id, choices: req.body.choices }
    responses.insert( response, function(err,objects) {
      /* FIXME handle error */
      if ( err ) { console.log(err); }
      res.redirect("/results/" + req.params.id );  
    });
  });
  app.get('/results/:id',function(req,res){
    var surveys = new mongodb.Collection(client,'surveys');
    var responses = new mongodb.Collection(client,'responses');
    var id = new client.bson_serializer.ObjectID(req.params.id);
    surveys.findOne( { _id: id }, function(err,survey) {
      responses.find( { survey_id: id }).toArray(function(err,docs) {
        /* FIXME handle error */
        if ( err ) { console.log(err); }
        var total_responses = 0;
        var response_summary = {};
        docs.forEach(function(response){
          response.choices.forEach(function(e){
            if ( response_summary[e] ) {
              response_summary[e] += 1;
            } else {
              response_summary[e] = 1;
            }
              total_responses += 1;
          });
        });
        var percentages = {};
        for( r in response_summary ) {
           var n = Math.round( 100.0 * response_summary[r] / total_responses );
           percentages[r] = n;
        }
        res.render('results.ejs', { id: req.params.id, survey: survey, results: docs, percentages: percentages } );
      });
    });
  });
  var port = process.env.VCAP_APP_PORT || process.env.PORT || 8001;
  app.listen(port);
  console.log('Server listing on port '+ port);

};

if ( process.env.VCAP_SERVICES ) {
  var service_type = "mongodb-1.8";
  var json = JSON.parse(process.env.VCAP_SERVICES);
  var credentials = json[service_type][0]["credentials"];
  console.log("Credentials:");
  console.log(credentials);
  var server = new mongodb.Server( credentials["host"], credentials["port"]);
  new mongodb.Db( credentials["db"], server, {} ).open( function(err,client) {
    client.authenticate( credentials["username"], credentials["password"], function(err,replies) { 
      console.log("mongodb authenticated");
      run(client);
    });
  });
} else {
  console.log("Connecting to mongodb on localhost");
  var server = new mongodb.Server("127.0.0.1",27017,{});
  new mongodb.Db( "mongo_survey", server, {} ).open( function(err,client) {
    if ( err ) { throw err; }
    console.log("mongodb opened");
    run(client);
  });
}



