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
// Code to run if we're in a worker process
} else {
  var AWS = require('aws-sdk');
  var express = require("express");
  var bodyParser = require("body-parser");
  var date = require(__dirname + "/date.js");

  AWS.config.update({region: 'us-east-1'});
  var ddb = new AWS.DynamoDB();
  var ddbTable = 'todoApp';
  var app = express();

  app.set('view engine', 'ejs');
  app.set('views', __dirname + '/views');
  app.use(bodyParser.urlencoded({extended: true}))
  app.use(express.static("public"));

  var defaultItems = ['Add your first task!!!'];
  const capitalize = (s) => {
      if (typeof s !== 'string') return ''
      return s.charAt(0).toUpperCase() + s.slice(1)
    }
// *************************************Get / page ***********************************
  function findtask(req, res, next){
    let items =[];
    // scan the data base for all tasks and construct the task list
    var params = {
      TableName: ddbTable,
      ProjectionExpression: "task_name, task_tag",
      FilterExpression:'task_status = :ttt',
      ExpressionAttributeValues: {
            ':ttt': {S: 'UnDo'}
          }
    };
    ddb.scan(params, function(err, data) {
      if (err) {
        console.log("Line 52!!!!!!!!!!","Error", err);
      } else {
        // console.log("Success", data.Items);
        data.Items.forEach(function(task) {
          // console.log("for loop", task, typeof task.task_name.S);
          items.push(task.task_name.S);
          req.tasklist = items;
          // console.log(items)
        });
        if (req.tasklist == null){
              req.tasklist = defaultItems;
            }
        return next();
      }
    });
    // return task list
  }

  // just for render the page
  function rendertask(req, res) {
    let day = date.getDate();
    res.render("list", {
      listTitle: day,
      newListItems: req.tasklist,
      task_length: req.tasklist.length
    });
    console.log("sucess to render /");
}
  app.get("/",findtask, rendertask);

// ************************************* Add a new task ***********************************
  app.post('/', function(req,res){
    // var customtag = req.params.customListName;
    let today = date.getDate();
    var newtag = '/'
    console.log(req.body.list, today, req.body.list===today);
    if(req.body.list.substring(0, 5) !== today.substring(0, 5)){
      newtag = req.body.list;
      console.log("newtag", newtag)
      }
    console.log("newtag", newtag)
    var item = {
            'task_name': {'S': req.body.newItem},
            'task_tag': {'S': newtag},
            'task_day': {'S': today},
            'task_status': {'S': "UnDo"}
        };
    console.log(item)
    // console.log(ddbTable);
    // console.log(item);

    // var params = {
    //   'TableName': ddbTable,
    //   'Item': item,
    //   'Expected': { name: { Exists: false } }
    // };

    ddb.putItem({
            'TableName': ddbTable,
            'Item': item,
            'Expected': { task_name: { Exists: false } }
        }, function(err, data) {
        if (err) {
            console.log("line 85 !!!!!!!!!!!!!!!!!", ddbTable);
            var returnStatus = 500;
            if (err.code === 'ConditionalCheckFailedException') {
                returnStatus = 409;
            }
            res.status(returnStatus).end();
            console.log('DDB Error: ' + err);
        }else{
          console.log('Success adding new task');
        }
    });

    if(newtag==='/'){
      res.redirect("/");
    }else{
      res.redirect("/" + req.body.list);
    }
  });
// *************************************Get work page ***********************************
  function findworktask(req, res, next){
    var customListName = capitalize(req.params.customListName);
    console.log(customListName)
    let workItems = [];
    // scan the data base for all tasks and construct the task list
    var params = {
      TableName: ddbTable,
      ProjectionExpression: 'task_name, task_tag',
      FilterExpression:'task_tag = :ttt and task_status = :sss',
      ExpressionAttributeValues: {
            ':ttt': {S: customListName},
            ':sss': {S: 'UnDo'}
        }
    };

    ddb.scan(params, function(err, data) {
      if (err) {
        console.log("Line 136!!!!!!!!!!","Error", err);
      } else {
        // console.log("Success", data.Items);
        data.Items.forEach(function(task) {
          // console.log("for loop", task, typeof task.task_name.S);
          workItems.push(task.task_name.S);
          req.tasklist = workItems;
          // console.log(workItems)
        });
        if (req.tasklist == null){
              req.tasklist = defaultItems;
            }
        return next();
      }
    });

  }

  // just for render the page
  function renderworktask(req, res) {
    var customListName = capitalize(req.params.customListName);
    console.log(customListName)
    let day = date.getDate();
    res.render("list", {
      listTitle: customListName,
      newListItems: req.tasklist,
      task_length: req.tasklist.length
    });
    console.log("sucess to render /:customListName")
  }

  app.get("/:customListName",findworktask, renderworktask);

// ************************************* Finish checkbox ***********************************
  app.post("/delete", function(req, res){
    let today = date.getDate();
    console.log("this is the delete feature !!!!!!!!!!!!!!!!!!!!!")
    let checkedItemName = req.body.checkbox;
    console.log(checkedItemName)
    // var item = {
    //         'task_name': {'S': req.body.checkedItemName},
    //         'task_status': {'S': "Checked"}
    //     };
    var params = {
      'TableName': ddbTable,
      'ExpressionAttributeNames': {
           "#S": "task_status"
          },
      'ExpressionAttributeValues': {
           ":sss": {'S': "Checked"}
          },
      'Key': {
       "task_name": {'S': checkedItemName}
          },
      'UpdateExpression': "SET #S = :sss"
      }

    // Call DynamoDB to update the item to the table
    ddb.updateItem(params, function(err, data) {
      if (err) {
        console.log("Line 182!!!!!!!!!!!!!","Error", err);
      } else {
        console.log("Success", data);
      }
    });

    if(req.body.listName.substring(0, 5)!== today.substring(0, 5)){
      res.redirect("/"+req.body.listName);
    }else{
      res.redirect("/");
    }
  });



  var port = process.env.PORT || 3000;

  var server = app.listen(port, function () {
      console.log('Server running at http://127.0.0.1:' + port + '/');
    });
  }
