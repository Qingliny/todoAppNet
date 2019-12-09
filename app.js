// Include the cluster module
var cluster = require('cluster');

// Code to run if we're in the master process
if (cluster.isMaster) {

    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;

    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        cluster.fork();
    }

    // Listen for terminating workers
    cluster.on('exit', function (worker) {

        // Replace the terminated workers
        console.log('Worker ' + worker.id + ' died :(');
        cluster.fork();

    });
} else {
  var AWS = require('aws-sdk');
  const express = require("express");
  const bodyParser = require("body-parser");
  const date = require(__dirname + "/date.js");

  AWS.config.region = process.env.REGION
  var ddb = new AWS.DynamoDB();
  var ddbTable =  process.env.todoApp;
  var app = express();

  app.set('view engine', 'ejs');
  app.set('views', __dirname + '/views');
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(express.static("public"));


  app.get("/", function(req, res){
    let items =[];
    let day = date.getDate()

    var params = {
      ProjectionExpression: 'name, tag, day',
      TableName: ddbTable
    };

    ddb.scan(params, function(err, data) {
      if (err) {
        console.log("Error", err);
      } else {
        console.log("Success", data.Items);
        data.Items.forEach(function(task) {
          items.push(task.name);
        });
      }
    });

    res.render("list", {
      listTitle: day,
      newListItems: items
    });

  });

  app.post('/', function(req,res){
    let name = req.body.newItem;
    let day = date.getDate()
    var item = {
            'name': {'S': req.body.newItem},
            'tag': {'S': req.body.list}
            'day': {'S': day}
        };

    var params = {
      TableName: ddbTable,
      Item: item,
      'Expected': { name: { Exists: false } }
    };

    ddb.putItem(params, function(err, data) {
        if (err) {
            var returnStatus = 500;
            if (err.code === 'ConditionalCheckFailedException') {
                returnStatus = 409;
            }
            res.status(returnStatus).end();
            console.log('DDB Error: ' + err);
        }else{
          console.log('Success adding new task');
        }
      }
    });

    if(req.body.list==="Work"){
      res.redirect("/work");
    }else{
      res.redirect("/");
    }
  });


  app.get("/work",function(req, res){
    let workItems = [];
    var params = {
      TableName: ddbTable,
      ProjectionExpression: 'name, tag, day',
      KeyConditionExpression:'tag = :t',
      ExpressionAttributeNames:{
        ':t': 'work'
      }
    };

    ddb.query(params, function(err, data) {
      if (err) {
        console.log("Error", err);
      } else {
        console.log("Success", data.Items);
        data.Items.forEach(function(task) {
          workItems.push(task.name);
        });
      }
    });
    res.render("list", {
      listTitle: "Work",
      newListItems: workItems
    });
  })

  // app.post('/work', function(req,res){
  //   let item = req.body.newItem;
  //   workItems.push(item);
  //   res.redirect("/work");
  // });


  var port = process.env.PORT || 3000;

  var server = app.listen(port, function () {
      console.log('Server running at http://127.0.0.1:' + port + '/');
    });
  }
