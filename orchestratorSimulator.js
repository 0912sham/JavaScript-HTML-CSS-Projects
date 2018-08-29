var testAgainstSimulator = true;

//const prefixKB = "frc:<http://www.ontologies.com/FASTory_robot_cell.owl#>";
const uriKB = "http://www.ontologies.com/FASTory_robot_cell.owl#";
const frcPrefix = "frc:";
const prefixKB = frcPrefix + "<" + uriKB + ">";

const prefixRdf = "rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>";
const rdfPrefix = "rdf:";


var http = require('http');
var events = require('events');
var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');


var stepIntoStep = 'init';
var currentlyInStep = '';


var notificationIDs = {};

var availableScreens = {};
var availableKeyboards = {};
var availableFrames = {};

function insertOrder(orderData)
{
    // Check if all required properties are there
    if(orderData.hasOwnProperty('selectedFrame') && orderData.hasOwnProperty('selectedScreen') && orderData.hasOwnProperty('selectedKeyboard'))
    {
        // Check that none of the properties are empty
        if((orderData['selectedFrame'] != '') && (orderData['selectedScreen'] != '') && (orderData['selectedKeyboard'] != ''))
        {
            var orderId = Math.floor((Math.random() * 100000) + 1);
            var options = {
                method: 'post',
                // Insert the cell phone order to the KB. The query will insert the order id, selected screen, frame and keyboard and empty rfidTag to it, as it is currently not linked to any pallet
                body: "update= PREFIX "+prefixKB+ " PREFIX " +prefixRdf+ " INSERT DATA {"+frcPrefix+"Order_" + orderId + " "+rdfPrefix+"type " +frcPrefix + "Order. " +
                frcPrefix+"Order_" + orderId + " " + frcPrefix + "hasFrame " + frcPrefix + orderData['selectedFrame'] + ". " +
                frcPrefix+"Order_" + orderId + " " + frcPrefix + "hasScreen " + frcPrefix + orderData['selectedScreen'] + ". " +
                frcPrefix+"Order_" + orderId + " " + frcPrefix + "hasKeyboard " + frcPrefix + orderData['selectedKeyboard'] + ". " +
                frcPrefix+"Order_" + orderId + " " + frcPrefix + "rfidTag" + " \"\"" + "}", // Javascript object
                json: true, // Use,If you are sending JSON data
                url: "http://localhost:3030/iii2017/update",
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Accept': 'application/sparql-results+json,*!/!*;q=0.9'
                }
            };
            request(options, function (err, res, body) {
                if (err) {
                    console.log('Error :', err);
                    return;
                }
                ///console.log(body);
                console.log("Order with id " , orderId, "added to the KB");
                console.log('sent');
            });
        }
    }

}

function requestKBOrderData(palletId)
{
    var options = {
        method: 'post',
        // Query pallets, which have the rfid tag of the pallet on zone 1.
        body: "query= PREFIX " + prefixKB + " PREFIX " + prefixRdf + " SELECT ?order WHERE {?order frc:rfidTag \"" + palletId + "\"}", // Javascript object
        json: true, // Use,If you are sending JSON data
        url: "http://127.0.0.1:3030/iii2017/query",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/sparql-results+json,*!/!*;q=0.9'
        }
    };

    request(options, function(err, res, body) {
        if (err) {
            console.log('Error :', err);
            return;
        }

        // wait for the answer from the request
        var myTimer = setInterval(
            function waitForCondition(){
                var responseJson = JSON.parse(JSON.stringify(body.results.bindings));

                //The pallet id does not respond to any order we have in the system, (responseJson length == 0)
                if(responseJson.length == 0)
                {
                    console.log('no order on the pallet, link it to one');
                    linkOrderWithPallet(palletId);
                }
                // we have order with the ID, retrieve the order data and
                else
                {
                    console.log('found order for the pallet, request data from the KB');
                    retrieveOrderToFill(responseJson[0]);
                    //retrievePhoneUnderWork(palletId);
                }

                clearInterval(myTimer);
            }, 500);
    });
}

/*
    Function receives the order id in json format and queries the KB which components are to be used in the cellphone
 */
function retrieveOrderToFill(orderJson)
{
    //Check that json is in correct format
    if(orderJson.hasOwnProperty('order'))
    {
        if(orderJson.order.hasOwnProperty('value'))
        {
            parseOrder = String(orderJson.order.value);
            order = parseOrder.replace(uriKB, "");
        }
    }

    console.log(order);
    var options = {
        method: 'post',
        // Query the components of the order
        body: "query= PREFIX " + prefixKB + " PREFIX " + prefixRdf + " SELECT ?property ?component WHERE {" + frcPrefix + order + " ?property ?component.}", // Javascript object
        //body: "query= PREFIX " + prefixKB + " PREFIX " + prefixRdf + " SELECT ?property ?component WHERE {" + frcPrefix + order + " ?property ?component. groupBy " + frcPrefix + order + "?property ?component GROUPBY " + frcPrefix + order + "}" , // Javascript object
        json: true, // Use,If you are sending JSON data
        url: "http://127.0.0.1:3030/iii2017/query",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/sparql-results+json,*!/!*;q=0.9'
        }
    };

    //Perform the request for the components from the order
    request(options, function(err, res, body) {
        if (err) {
            console.log('Error :', err);
            return;
        }

        var myTimer = setInterval(
            function waitForCondition(){
                var responseJson = JSON.parse(JSON.stringify(body.results.bindings));
                console.log(responseJson);

                if(responseJson.length > 0)
                {
                    //Parse the results of the query for the parts
                    for(var i=0;i<responseJson.length;i++)
                    {
                        var tempJson = responseJson[i];
                        var component = '';

                        if(tempJson.hasOwnProperty('component'))
                        {
                            parseComponent = String(tempJson.component.value);
                            component = parseComponent.replace(uriKB, "");

                            if(component.indexOf('frame') == 0)
                            {
                                orderUnderWork.selectedFrame = component;
                            }
                            else if(component.indexOf('screen') == 0)
                            {
                                orderUnderWork.selectedScreen = component;
                            }
                            else if(component.indexOf('keyboard') == 0)
                            {
                                orderUnderWork.selectedKeyboard = component;
                            }
                        }
                    }
                }
                console.log(orderUnderWork);
                clearInterval(myTimer);
            }, 500);

    });
}


/*
    Requests orders from the KB, that do not have any RFID tags from pallet bound to the order
 */
function linkOrderWithPallet()
{
    var options = {
        method: 'post',
        // Select all individuals from KB, where rfidTag is empty and they are of class Order
        body: "query= PREFIX " + prefixKB + " PREFIX " + prefixRdf + " SELECT ?order WHERE {?order frc:rfidTag \"\". ?order rdf:type frc:Order}", // Javascript object
        json: true, // Use,If you are sending JSON data
        url: "http://127.0.0.1:3030/iii2017/query",
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/sparql-results+json,*!/!*;q=0.9'
        }
    };
    //Send request to KB for the orders
    request(options, function(err, res, body) {
        if (err) {
            console.log('Error :', err);
            return;
        }

        // Wait for answer from the KB
        var myTimer = setInterval(
            function waitForCondition(){
                var ordersInQueue = JSON.parse(JSON.stringify(body.results.bindings));
                console.log(ordersInQueue);
                if(ordersInQueue.length > 0)
                {
                    var selectOrderToPallet = ordersInQueue[0];

                    //Check if there is still pallet in the zone 1
                    if(cellZoneStates.zone1.state != '-1')
                    {
                        //Check if the json object for first order in the queue
                        if(selectOrderToPallet.order.hasOwnProperty('value'))
                        {
                            parseOrder = String(selectOrderToPallet.order.value);
                            order = parseOrder.replace(uriKB, "");

                            var options = {
                                method: 'post',
                                // update the rfid tag to the selected order. first the old value will be deleted with DELETE and new value will be placed instead with the INSERT - WHERE statements
                                body: "update= PREFIX "+prefixKB+ " PREFIX " +prefixRdf+ " DELETE {"+ frcPrefix + order + " " + frcPrefix + "rfidTag" + "\"\" }" +
                                                                                         " INSERT {"+ frcPrefix + order + " " + frcPrefix + "rfidTag \"" +  cellZoneStates.zone1.state + "\"}" +
                                                                                         " WHERE {"+ frcPrefix + order + " " + frcPrefix + "rfidTag" + "\"\" }", // Javascript object
                                json: true, // Use,If you are sending JSON data
                                url: "http://127.0.0.1:3030/iii2017/update",
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                    'Accept': 'application/sparql-results+json,*!/!*;q=0.9'
                                }
                            };
                            request(options, function (err, res, body) {
                                if (err) {
                                    console.log('Error :', err);
                                    return;
                                }
                                console.log("Updated rfidTag to specific order");
                            });
                        }
                    }
                }
                clearInterval(myTimer);
            }, 500);
    });
}


function validateOrder(orderData)
{
    var orderIsValid = true;

    // check that all components are present
    if(!orderData.hasOwnProperty('selectedFrame'))
    {
        orderIsValid = false;
    }
    if(!orderData.hasOwnProperty('selectedKeyboard'))
    {
        orderIsValid = false;
    }
    if(!orderData.hasOwnProperty('selectedScreen'))
    {
        orderIsValid = false;
    }

    return orderIsValid;
}
app = express();

app.use(bodyParser.json());

hostname = 'localhost';

var WS = function(number){
    this._number = number; //Number of the ws
    this.Busy = false; // Flag for working ws
    this.Order = false; // Flag for reserved ws
    this.ordererID = 0; // Pallet ID of the one that has reserved or is being currently worked in the ws
    this.ordererPort = 0; // Pallet agent's port nubmer
    this.orderedPart = 0; // Desired part to manifacture of the Pallet
    this.Colour = 'RED'; // Colour of ws
    this.Z1 = -1; // Pallet ID currently at Z1
    this.Z2 = -1; // Pallet ID currently at Z1
    this.Z3 = -1; // Pallet ID currently at Z1
    this.Z4 = -1; // Pallet ID currently at Z1
    this.Z5 = -1; // Pallet ID currently at Z1
}

WS.prototype.changeZ1 = function (id){
    this.Z1 = id;
};

WS.prototype.changeZ2 = function (id){
    this.Z2 = id;
};

WS.prototype.changeZ3 = function (id){
    this.Z3 = id;
};



WS.prototype.runServer = function (port) {
    this.port = port;
    var ref = this;

    if (ref._number == 7) { //Agent for Loader ws
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z1_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z2_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z3_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z5_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimROB'+ref._number+'/events/PalletLoaded/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err, res) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimROB'+ref._number+'/events/PalletUnloaded/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});

        var myServer = http.createServer(function(req, res) {
            var method = req.method;
            console.log("Method: " + method);

            if (method == 'GET'){ // Prints the situation of ws
                res.end(ref.Z1.toString()+" "+ref.Z2.toString()+" "+ref.Z3.toString()+" "+ref.Z4.toString()+" "+ref.Z5.toString()+"::Order "+ref.Order.toString()+"::Orderer "+ref.ordererID.toString()+"::Busy "+ref.Busy.toString());
            }

            if (method == 'POST'){
                var body = [];
                req.on('data', function(chunk) {
                    body.push(chunk);
                    console.log("Body???: " + body.toString());

                    // Parse body to get message id and payload
                    parsed_input = body.toString().split(",");
                    parsed_id = parsed_input[0].split(":");
                    parsed_PalletID =  parsed_input[3].split(":");
                    console.log(parsed_PalletID[1]);
                    parsed_PID = 0;
                    if (parsed_PalletID[1] == "{}}" || parsed_PalletID[1]== "{}") {
                        console.log("Has no payload");
                    } else {
                        parsed_PID = replaceall("}", "", parsed_PalletID[2]);
                        //parsed_PID = parsed_PalletID[2];
                        console.log(parsed_PID);
                    };
                    console.log(parsed_id[1]);


                    if (parsed_id[1] == '"Z1_Changed"'){ // Change the Z1 value according change and move pallet forward if one came rather than left

                        if (parsed_PID == -1){
                            setTimeout(function()
                            {ref.Z1 = -1},2000);

                        } else {
                            ref.Z1 = parsed_PID;
                            var interval = setInterval(function(){
                                if ( ref.Z2 == -1){
                                    request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/services/TransZone12', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                    clearInterval(interval);
                                }},500);
                        }
                    } else if(parsed_id[1] == '"Z2_Changed"'){ // Change the Z2 value according change and move pallet forward if one came rather than left
                        if (parsed_PID == -1){
                            setTimeout(function()
                            {ref.Z2 = -1},1000);
                        } else {
                            ref.Z2 = parsed_PID;
                            var interval = setInterval(function(){
                                if ( ref.Z3 == -1){
                                    request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/services/TransZone23', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                    clearInterval(interval);
                                }},500);
                        }
                    } else if(parsed_id[1] == '"Z3_Changed"') { // Change the Z3 value according change and make queries to conclude if pallet needs to ne unload
                        if (parsed_PID == -1) {
                            setTimeout(function()
                            {ref.Z3 = -1},2500);
                        } else {
                            ref.Z3 = parsed_PID;

                            setTimeout(function()
                            {ref.Z3 = -1},3000);

                            if (ref.Busy == false) { //In case of ws7 ref.Busy refers to loading new pallet. This flag prevents the newly loaded pallet from instantly being unloaded

                                request({ // Request the destination of pallet from pallet manager. If coming to ws7 then unload it else move it forward
                                    url: 'http://localhost:5555/findDest',
                                    method: "POST",
                                    body: parsed_PID,
                                    headers: {'Content-Type': 'text/json'}
                                }, function (req, res, err) {

                                    //console.log(res.body);
                                    parsed_des = res.body.split(":");
                                    //console.log(parsed_des[1])

                                    if (parsed_des[1] == "{}}" || parsed_des[1] == "{}") {
                                        console.log("Has no destination");
                                    } else {
                                        var dest = replaceall("}", "", parsed_des[1]);
                                        //console.log(dest);
                                        if (dest == '"7"') {
                                            request.post('http://localhost:3000/RTU/SimROB7/services/UnloadPallet', {form: {destUrl: "http://localhost:" + port}}, function (err) {if (err) {console.log(err)}});

                                         /*   request({
                                                url: 'http://localhost:5555/unloaded',
                                                method: "POST",
                                                body: parsed_PID,
                                                headers:{'Content-Type':'text/json'}
                                            },function (err, res, body) {console.log(body)});*/

                                        } else {
                                            var interval = setInterval(function(){
                                                if ( ref.Z5 == -1){
                                                    request.post('http://localhost:3000/RTU/SimCNV' + ref._number + '/services/TransZone35', {form: {destUrl: "http://localhost:" + port}}, function (err) {if (err) {console.log(err)}});
                                                    clearInterval(interval);
                                                }},500);
                                        }
                                    }
                                });
                            } else if (ref.Busy == true) {
                                var interval = setInterval(function(){
                                    if ( ref.Z5 == -1){
                                        request.post('http://localhost:3000/RTU/SimCNV' + ref._number + '/services/TransZone35', {form: {destUrl: "http://localhost:" + port}}, function (err) {if (err) {console.log(err)}});
                                        clearInterval(interval);
                                    }},500);

                                ref.Busy = false;
                            }
                        }
                    } else if (parsed_id[1] == '"Z5_Changed"') { // Change the Z5 value according change

                        if (parsed_PID == -1) {
                            setTimeout(function()
                            {ref.Z5 = -1},2000);
                        } else {
                            ref.Z5 = parsed_PID;
                        }

                    } else if(parsed_id[1] == '"PalletLoaded"'){ //Inform pallet manager of a new loaded pallet
                        request({
                            url: 'http://localhost:5555/newID',
                            method: "POST",
                            body: parsed_PID,
                            headers:{'Content-Type':'text/json'}
                        },function (err, res, body) {console.log(body)});

                    } else if (parsed_id[1] == '"PalletUnloaded"'){ //Subcription does not work. Therefore this has no real meaning in code

                        ref.Z3 = -1;
                        console.log(ref.Z1+ref.Z2+ref.Z3+ref.Z5);
                    } else if (parsed_id[1] == '"LoadNew"'){ //Request from pallet manager to load new pallet

                        ref.Busy = true;
                        console.log(ref.Z1+ref.Z2+ref.Z3+ref.Z5);
                        var interval = setInterval(function(){
                            if ( ref.Z3 == -1 && ref.Z2 == -1){
                                request.post('http://localhost:3000/RTU/SimROB7/services/LoadPallet', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                clearInterval(interval);
                            }},100);

                    }


                })
            }
        })
    } else if(ref._number == 1){ //Agent for paper handling ws

        request.post('http://localhost:3000/RTU/reset', {form: {destUrl: "http://localhost"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z1_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z2_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z3_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z5_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimROB'+ref._number+'/events/PaperLoaded/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err, res) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimROB'+ref._number+'/events/PaperUnloaded/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});

        var myServer = http.createServer(function(req, res) {
            var method = req.method;
            console.log("Method: " + method);

            if (method == 'GET'){ // Prints the situation of ws
                res.end(ref.Z1.toString()+" "+ref.Z2.toString()+" "+ref.Z3.toString()+" "+ref.Z4.toString()+" "+ref.Z5.toString()+"::Order "+ref.Order.toString()+"::Orderer "+ref.ordererID.toString()+"::Busy "+ref.Busy.toString());
            }

            if (method == 'POST'){
                var body = [];
                req.on('data', function(chunk) {
                    body.push(chunk);
                    console.log("Body???: " + body.toString());

                    //Parse information from the request body
                    parsed_input = body.toString().split(",");
                    parsed_id = parsed_input[0].split(":");
                    parsed_PalletID =  parsed_input[3].split(":");
                    if (parsed_PalletID[1] == "{}}" || parsed_PalletID[1] == "{}") {
                        console.log("Has no payload");

                    } else {
                        parsed_PID = replaceall("}", "", parsed_PalletID[2]);
                        //parsed_PID = parsed_PalletID[2];
                        console.log(parsed_PID);
                    };
                    //console.log(parsed_id[1]);

                    //console.log(ref.Z1.toString()+" "+ref.Z2.toString()+" "+ref.Z3.toString()+" "+ref.Z5.toString());
                    //console.log(ref.ordererID.toString()+" "+ref.ordererPort.toString());

                    if (parsed_id[1] == '"Z1_Changed"'){ // Change the Z1 value according change and move pallet forward if one came rather than left
                        if (parsed_PID == -1){
                            setInterval(function(){
                            ref.Z1 = -1},2000);

                        } else {
                            ref.Z1 = parsed_PID;
                            var interval = setInterval(function(){
                                if ( ref.Z2 == -1){
                                    request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/services/TransZone12', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                    clearInterval(interval);
                                }},500);
                        }
                    } else if(parsed_id[1] == '"Z2_Changed"'){ // Change the Z2 value according change and move pallet forward if one came rather than left
                        if (parsed_PID == -1){
                            setTimeout(function()
                            {ref.Z2 = -1},2000);
                        } else {
                            ref.Z2 = parsed_PID;
                            var interval = setInterval(function(){
                                if ( ref.Z3 == -1){
                                    request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/services/TransZone23', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                    clearInterval(interval);
                                }},500);
                        }
                    } else if(parsed_id[1] == '"Z3_Changed"'){ // Change the Z3 value according change and request info of the recieved pallet
                        if (parsed_PID == -1){
                            setTimeout(function()
                            {ref.Z3 = -1},2500);
                            ref.ordererID = 0;
                        } else{
                            ref.Z3 = parsed_PID;
                            ref.ordererID = replaceall('"',"",parsed_PID);

                            request({   // Ask pallet's destination from pallet manager. IF destination is to 1 then either load or unload paper, which ever is possible
                                url: 'http://localhost:5555/findDest',
                                method: "POST",
                                body: parsed_PID,
                                headers: {'Content-Type': 'text/json'}
                            }, function (req, res, err) {
                                //console.log(res.body);
                                parsed_des = res.body.split(":");
                                //console.log(parsed_des[1])
                                if (parsed_des[1] == "{}}" || parsed_des[1] == "{}") {
                                    console.log("Has no destination");
                                } else {
                                    var dest = replaceall("}", "", parsed_des[1]);
                                    //console.log(dest);
                                    if (dest == '"1"') {
                                        console.log("finding paper of "+parsed_PID);
                                        request({
                                            url: 'http://localhost:5555/findPaper',
                                            method: "POST",
                                            body: ref.Z3,
                                            headers: {'Content-Type': 'text/json'}
                                        }, function (req, res, err) {
                                            console.log(res.body);
                                            parsed_res = res.body.split(",")
                                            parsed_paper = parsed_res[0].split(":");
                                            parsed_port = parsed_res[1].split(":")
                                            console.log(parsed_paper[1] +" "+parsed_port[1]);
                                            if (parsed_paper[1] == "{}}" || parsed_paper[1] == "{}") {
                                                console.log("Pallet has no idea of its paper situation");

                                            } else {
                                                ref.ordererPort = replaceall("}", "", parsed_port[1]);
                                                var paper = parsed_paper[1];
                                                //console.log("Paper to take off or put: "+paper+" "+ref.ordererPort.toString());
                                                if (paper == '"true"') {
                                                    request.post('http://localhost:3000/RTU/SimROB1/services/UnloadPaper', {form: {destUrl: "http://localhost:" + port}}, function (err) {if (err) {console.log(err)}})

                                                } else if (paper == '"false"') {
                                                    request.post('http://localhost:3000/RTU/SimROB1/services/LoadPaper', {form: {destUrl: "http://localhost:" + port}}, function (err) {if (err) {console.log(err)}})

                                                } else{
                                                    console.log("I GIVE YOU NO PAPER");
                                                }

                                            }

                                        });

                                    } else {
                                        console.log("Pallet has no destination. Sending to WS7!");
                                        var interval = setInterval(function(){
                                            if ( ref.Z5 == -1){
                                                request.post('http://localhost:3000/RTU/SimCNV' + ref._number + '/services/TransZone35', {form: {destUrl: "http://localhost:" + port}}, function (err) {if (err) {console.log(err)}});
                                                clearInterval(interval);
                                            }},500);
                                    }
                                }
                            });
                        }
                    } else if (parsed_id[1] == '"Z5_Changed"') { // Change the Z5 value according change

                        if (parsed_PID == -1) {
                            setTimeout(function()
                            {ref.Z5 = -1},2000);
                        } else {
                            ref.Z5 = parsed_PID;
                        }

                    }else if(parsed_id[1] == '"PaperLoaded"'){ //Inform pallet agent that paper was loaded
                        console.log("Informing of loaded paper: "+ref.ordererPort);
                        request({
                            url: 'http://localhost:'+ref.ordererPort,
                            method: "POST",
                            body: '{id:"PaperLoaded",senderID:"WS1",lastEmit:0,payload:{}}',
                            headers: {'Content-Type': 'text/json'}
                        }, function (req, res, err) {});

                        /*ref.ordererPort = 0;
                        console.log(ref.ordererPort);
                        var interval = setInterval(function(){
                            if ( ref.Z5 == -1){
                                console.log(ref.Z5.toString());
                                request.post('http://localhost:3000/RTU/SimCNV' + ref._number + '/services/TransZone35', {form: {destUrl: "http://localhost:" + port}}, function (err) {if (err) {console.log(err)}});
                                clearInterval(interval);
                            }},500);*/

                    } else if (parsed_id[1] == '"PaperUnloaded"'){ //Inform pallet agent of unloading paper
                        console.log("Paper unloaded from: "+ref.ordererPort);
                        request({
                            url: 'http://localhost:'+ref.ordererPort,
                            method: "POST",
                            body: '{id:"PaperUnLoaded",senderID:"WS1",lastEmit:0,payload:{}}',
                            headers: {'Content-Type': 'text/json'}
                        }, function (req, res, err) {});

                        ref.ordererPort = 0;
                        var interval = setInterval(function(){
                            if ( ref.Z5 == -1){
                                request.post('http://localhost:3000/RTU/SimCNV' + ref._number + '/services/TransZone35', {form: {destUrl: "http://localhost:" + port}}, function (err) {if (err) {console.log(err)}});
                                clearInterval(interval);
                            }},500);

                    } else if(parsed_id[1] == '"ForceMove"'){ //Allows pallet agent to request for transfer forward
                        console.log("WS1 FM reference: "+ref.ordererID+" "+parsed_Sender[1]);

                        //if (ref.ordererID == parsed_Sender[1]){
                            ref.ordererPort = 0;

                            var interval = setInterval(function(){
                                if ( ref.Z5 == -1 ){
                                    request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/services/TransZone35', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                    clearInterval(interval);
                                }},500);

                           /* setTimeout(function(){
                                var reference = ref.Z5;
                                console.log("WS1 FM reference 2: "+ref.ordererID+" "+reference);
                                if(!(ref.ordererID == reference)){
                                    ref.ordererID = 0;
                                    /*var interval = setInterval(function(){
                                        if ( ref.Z5 == -1 ){*/
                                            //request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/services/TransZone35', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                           /* clearInterval(interval);
                                        }},500);
                                }

                            },2500);*/
                        //}
                    }

                })
            }
        })

    } else { //ws agents for normal wsess

        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z1_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z2_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z3_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z4_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/events/Z5_Changed/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimROB'+ref._number+'/events/PenChanged/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
        request.post('http://localhost:3000/RTU/SimROB'+ref._number+'/events/DrawEndExecution/notifs', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});

        var myServer = http.createServer(function(req, res) {
            var method = req.method;
            console.log("Method: " + method);

            if (method == 'GET'){ //To get situation of the ws
                res.end(ref.Z1.toString()+" "+ref.Z2.toString()+" "+ref.Z3.toString()+" "+ref.Z4.toString()+" "+ref.Z5.toString()+"::Order "+ref.Order.toString()+"::Orderer "+ref.ordererID.toString()+"::Busy "+ref.Busy.toString());

            }

         if (method == 'POST'){
              var body = [];
             req.on('data', function(chunk) {
                 body.push(chunk);
                 console.log("Body???: " + body.toString());

                 parsed_input = body.toString().split(",");
                 parsed_id = parsed_input[0].split(":");
                 parsed_PalletID =  parsed_input[3].split(":");
                 parsed_Sender = parsed_input[1].split(":");

                 if (parsed_PalletID[1] == "{}}") {
                     console.log("Has no payload");

                 } else {
                     parsed_PID = replaceall("}", "", parsed_PalletID[2]);
                     parsed_PID = replaceall('"',"",parsed_PID);
                     //parsed_PID = parsed_PalletID[2];
                     console.log(parsed_PID);
                 };

                 console.log(parsed_id[1]);
                 console.log(ref.Z1.toString()+" "+ref.Z2.toString()+" "+ref.Z3.toString()+" "+ref.Z4.toString()+" "+ref.Z5.toString());
                 console.log(ref.ordererID.toString()+" "+ref.ordererPort.toString());

                    if (parsed_id[1] == '"Z1_Changed"'){ // Change the Z1 value according change and move pallet forward if one came rather than left
                            if (parsed_PID == -1){
                                setTimeout(function()
                                {ref.Z1 = -1},2000);
                            } else {
                                ref.Z1 = parsed_PID;
                                if (ref.Order == false && ref.Busy == false) { //If ws has no order or is not busy then just move pallet forward

                                    var interval = setInterval(function(){
                                        if ( ref.Z2 == -1){
                                            console.log(ref.Z1);
                                            request.post('http://localhost:3000/RTU/SimCNV' + ref._number + '/services/TransZone12', {form: {destUrl: "http://localhost:" + port}}, function (err) {if (err) {console.log(err)}})
                                            clearInterval(interval);
                                        }},500);
                                } else if (ref.Order == true && ref.Busy == false) { //If has order then check if pallet is the one who ordered
                                    console.log(parsed_PID+" "+ref.ordererID);
                                    if(parsed_PID == ref.ordererID) {
                                        ref.Busy = true;
                                    }

                                    var interval = setInterval(function(){
                                        if ( ref.Z2 == -1){
                                            request.post('http://localhost:3000/RTU/SimCNV' + ref._number + '/services/TransZone12', {form: {destUrl: "http://localhost:" + port}}, function (err) {if (err) {console.log(err)}})
                                            clearInterval(interval);
                                        }},500);

                                } else if (ref.Busy == true) { //If ws busy at working then move pallet forward through Z4

                                    var interval = setInterval(function(){
                                        if ( ref.Z4 == -1){
                                            request.post('http://localhost:3000/RTU/SimCNV' + ref._number + '/services/TransZone14', {form: {destUrl: "http://localhost:" + port}}, function (err) {if (err) {console.log(err)}})
                                            clearInterval(interval);
                                        }},500);
                         }
                     }
                    } else if(parsed_id[1] == '"Z2_Changed"'){ // Change the Z2 value according change and move pallet forward if one came rather than left
                        if (parsed_PID == -1){
                            setTimeout(function()
                            {ref.Z2 = -1},2000);
                        } else {
                            ref.Z2 = parsed_PID;
                            var interval = setInterval(function(){
                                console.log(ref.Z3);
                                if ( ref.Z3 == -1){
                                    request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/services/TransZone23', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                clearInterval(interval);
                            }},500);
                    }
                    } else if(parsed_id[1] == '"Z3_Changed"'){// Change the Z3 value according change and move pallet forward if one came rather than left
                            if (parsed_PID == -1){
                                setTimeout(function() {
                                    ref.Z3 = -1;

                                    if (ref.Busy == true && ref.Z5 == ref.ordererID){ // If ws has readied work then its pallet client values are zeroed
                                        ref.Busy = false;
                                        ref.Order = false;
                                        ref.orderedPart = 0;
                                        ref.ordererID = 0;
                                        ref.ordererPort = 0;

                                }},2000);

                            } else {
                                ref.Z3 = parsed_PID;
                                console.log(ref.Busy.toString());

                                if (ref.Busy == true) { //If flagged as busy, then start ordered work. Else move pallet forward
                                    if (ref.ordererID == parsed_PID) {
                                        //console.log("BUSSIONBUSSI");
                                        request.post('http://localhost:3000/RTU/SimROB'+ref._number+'/services/Draw'+ref.orderedPart, {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});

                                    } else {
                                        var interval = setInterval(function(){
                                            console.log(ref.Z5);
                                            if ( ref.Z5 == -1 && ref.Z4 == -1){
                                                request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/services/TransZone35', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                                clearInterval(interval);
                                            }},500);
                                    }

                                } else {
                                    var interval = setInterval(function(){
                                        if ( ref.Z5 == -1 && ref.Z4 == -1){
                                         request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/services/TransZone35', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                            clearInterval(interval);
                                     }},500);

                                }
                            }
                    } else if(parsed_id[1] == '"Z4_Changed"'){ // Change the Z4 value according change and move pallet forward if one came rather than left

                            if (parsed_PID == -1) {
                                setTimeout(function()
                                {ref.Z4 = -1},2000);
                            } else {
                                ref.Z4 = parsed_PID;
                                var interval = setInterval(function(){
                                if ( ref.Z5 == -1 ){
                                    request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/services/TransZone45', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                    clearInterval(interval);
                                }},500);
                            }
                    } else if (parsed_id[1] == '"Z5_Changed"') { // Change the Z5 value according change

                        if (parsed_PID == -1) {
                            setTimeout(function()
                            {ref.Z5 = -1},2000);
                        } else {
                            ref.Z5 = parsed_PID;
                        }

                    } else if(parsed_id[1] == '"DrawEndExecution"'){//Inform orderer pallet agent for finished work

                        parsed_recipe = parsed_input[4].split(":");
                        var recipe = parsed_recipe[1];


                        parsed_colour = parsed_input[5].split(":");;
                        var colour = replaceall("}","",parsed_colour[1]);

                        console.log(parsed_PID+" "+recipe+" "+colour);

                        if (recipe == '"1"' || recipe == '"2"' || recipe == '"3"'){
                            console.log("Frame made");
                            request({
                                url: 'http://localhost:'+ref.ordererPort,
                                method: "POST",
                                body: '{id:"Framed",senderID:"WS'+ref._number+'",lastEmit:0,payload:{{PalletID:'+parsed_PID+',Recipe:'+recipe+',Colour:'+colour+'}}',
                                headers: {'Content-Type': 'text/json'}
                            }, function (req, res, err) {});

                        } else if (recipe == '"4"' || recipe == '"5"' || recipe == '"6"'){
                            console.log("Screen made");
                            request({
                                url: 'http://localhost:'+ref.ordererPort,
                                method: "POST",
                                body: '{id:"Screened",senderID:"WS'+ref._number+'",lastEmit:0,payload:{{PalletID:'+parsed_PID+',Recipe:'+recipe+',Colour:'+colour+'}}',
                                headers: {'Content-Type': 'text/json'}
                            }, function (req, res, err) {});

                        } else if (recipe == '"7"' || recipe == '"8"' || recipe == '"9"'){
                            console.log("Keyboard made");
                            request({
                                url: 'http://localhost:'+ref.ordererPort,
                                method: "POST",
                                body: '{id:"Keyboarded",senderID:"WS'+ref._number+'",lastEmit:0,payload:{{PalletID:'+parsed_PID+',Recipe:'+recipe+',Colour:'+colour+'}}',
                                headers: {'Content-Type': 'text/json'}
                            }, function (req, res, err) {});
                        }


                    } else if (parsed_id[1] == '"PenChanged"'){ //Change value of robot's colour
                        ref.Colour = parsed_PID;
                        console.log(ref.Colour);

                    } else if (parsed_id[1] == '"Colour"'){ //Respond colour of robot to pallet agent
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('{"Colour" :'+ref.Colour.toString()+'}');

                    } else if (parsed_id[1] == '"HasOrder"'){  //Respond order situation of robot to pallet agent
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('{"Order" :'+ref.Order.toString()+'}');

                    } else if (parsed_id[1] == '"Order"'){ //Handle ordering from pallet agent

                        var parsed_part = parsed_input[4].split(":");
                        var part = replaceall("}", "", parsed_part[1]);
                        console.log(parsed_PID.toString() + " " + parsed_Sender[1].toString() + " " + part);
                        console.log(ref.Order.toString()+" "+ref.Busy.toString());

                        if (ref.Busy == false) { //Handle pallet agent that is not at the ws

                            if(ref.Order == false) {
                                //console.log("NEW PALLET ORDER");
                                ref.Order = true;
                                ref.ordererPort = parsed_PID;
                                ref.ordererID = parsed_Sender[1];

                                ref.orderedPart = part;

                                res.setHeader('Content-Type', 'text/plain');
                                res.end('OK');
                            } else {
                                res.setHeader('Content-Type', 'text/plain');
                                res.end('Invalid order');
                            }
                        } else { //Handle pallet agent that is at the ws
                            if(ref.ordererID == parsed_Sender[1]){

                                //console.log("OLD PALLET ORDER");
                                ref.orderedPart = part;
                                res.setHeader('Content-Type', 'text/plain');
                                res.end('OK');
                                request.post('http://localhost:3000/RTU/SimROB'+ref._number+'/services/Draw'+ref.orderedPart, {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                            } else {

                                res.setHeader('Content-Type', 'text/plain');
                                res.end('Invalid order');
                            }
                        }
                    } else if (parsed_id[1] == '"ChangeColour"'){ //Handle rrequest from pallet agent
                        console.log(parsed_PID);
                        request.post('http://localhost:3000/RTU/SimROB'+ref._number+'/services/ChangePen'+parsed_PID, {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                        res.setHeader('Content-Type', 'text/plain');
                        res.end('OK');

                    } else if(parsed_id[1] == '"ForceMove"'){ //Handle request from pallet agent to move from ws
                        console.log(ref.ordererID +" "+replaceall('"',"",parsed_Sender[1]));

                        if (ref.ordererID == replaceall('"',"",parsed_Sender[1])){
                            var interval = setInterval(function(){
                                if ( ref.Z5 == -1 && ref.Z4 == -1){
                                    request.post('http://localhost:3000/RTU/SimCNV'+ref._number+'/services/TransZone35', {form: {destUrl: "http://localhost:"+port}}, function (err) {if (err) {console.log(err)}});
                                    clearInterval(interval);
                                }},500);
                        }
                    }



                    })
            }
    })};

    myServer.listen(port, "127.0.0.1", () => {
        console.log('RobotAgent server ' + ref._number + ' is running at http://127.0.0.1:' + port);
});
};





var WS1 = new WS(1);
var WS2 = new WS(2);
var WS3 = new WS(3);
var WS4 = new WS(4);
var WS5 = new WS(5);
var WS6 = new WS(6);
var WS7 = new WS(7);
var WS8 = new WS(8);
var WS9 = new WS(9);
var WS10 = new WS(10);
var WS11 = new WS(11);
var WS12 = new WS(12);

WS1.runServer(6001);
WS2.runServer(6002);
WS3.runServer(6003);
WS4.runServer(6004);
WS5.runServer(6005);
WS6.runServer(6006);
WS7.runServer(6007);
WS8.runServer(6008);
WS9.runServer(6009);
WS10.runServer(6010);
WS11.runServer(6011);
WS12.runServer(6012);