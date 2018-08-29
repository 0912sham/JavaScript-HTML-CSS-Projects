/**
 * 
 */
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


var stepIntoStep = 'init';
var currentlyInStep = '';

var robotDrawBusy = false;
var robotPenChangeBusy = false;

var orderUnderWork = {
    'selectedFrame' : "frame_1",
    'frameColor' : "BLUE",
    'selectedScreen' : "screen_2",
    'screenColor' : 'GREEN',
    'keyboardColor' : "RED",
    'selectedKeyboard' : "keyboard_2"
};

var currentPhone = {
    'frame' : "",
    'screen' : "",
    'keyboard' : ""
};

var cellZoneStates = {
    'zone1' : {'busy' : false, 'state' : '1234abcd'},
    'zone2' : {'busy' : false, 'state' : '-1'},
    'zone3' : {'busy' : false, 'state' : '-1'},
    'zone4' : {'busy' : false, 'state' : '-1'},
    'zone5' : {'busy' : false, 'state' : '-1'}
};


var notificationIDs = {};

var availableScreens = {};
var availableKeyboards = {};
var availableFrames = {};

/*
 Link the part and the corresponding command. If changes are made, modify also commandToPart.
 */
var partToCommand = {
    'frame_1' : 'Draw1',
    'frame_2' : 'Draw2',
    'frame_3' : 'Draw3',
    'keyboard_1' : 'Draw4',
    'keyboard_2' : 'Draw5',
    'keyboard_3' : 'Draw6',
    'screen_1' : 'Draw7',
    'screen_2' : 'Draw8',
    'screen_3' : 'Draw9'
};

/*
 Link the command and corresponding part. If changes are made, modify also partToCommand.
 */
var commandToPart = {
    '1' : 'frame_1',
    '2' : 'frame_2',
    '3' : 'frame_3',
    '4' : 'keyboard_1',
    '5' : 'keyboard_2',
    '6' : 'keyboard_3',
    '7' : 'screen_1',
    '8' : 'screen_2',
    '9' : 'screen_3'
};

// Configuration for FASTory line. Comment if using simulator

const robotDestinationHost = "http://192.168.9.1";
const conveyorDestinationHost = "http://192.168.9.2";
const cellCode = "/rest";
const applicationHost = "http://192.168.9.55";
const nextCellConveyorHost = "http://192.168.3.2";

// Configuration for simulator. Comment if using FASTory line
/*const robotDestinationHost = simulatorHost;
 const conveyorDestinationHost = simulatorHost;
 const cellCode = "SimCNV8";
 //const applicationHost = "http://130.230.157.112";
 const applicationHost = "http://192.168.43.106";*/


// http server's port
var port = 5000;

/**
 * Set up http server that listens to the http posts from controllers
 */
var server = http.createServer(function (req,res){
setTimeout(function(){subscribtionCallBack(req,res);},500);
});
server.listen(port);
console.log("Server running at http://" + applicationHost + ":" + port);


/**
 * Callback function that is called when new http post is received. Called when any subscribed event occurs
 */
function subscribtionCallBack(request, response)
{
    console.log(request.method);
    if (request.method == 'POST')
    {
        var jsonString = '';

        request.on('data', function (data)
        {
            jsonString += data;
        });

        // When we know there is no more data coming, parse the data
        request.on('end', function ()
        {
            var eventData = JSON.parse(jsonString);
            //console.log(eventData);
            //The data application received has key 'ui' in the JSON object. It was sent from the user interface
            if(eventData.hasOwnProperty('ui'))
            {
                analyzeUiRequest(eventData);
            }
            //The data has key 'id' in the JSON object. It was sent from the controllers
            else if(eventData.hasOwnProperty('id'))
            {
                analyzeEvent(eventData);
            }
            else
            {
                console.log('unrecognized request');
            }
            //end the transaction.
            response.end('ok');
        });
    }
    //The user interface requests for options from the server with method "OPTIONS"
    else if (request.method == 'OPTIONS')
    {
        response.statusCode = 200;
        response.setHeader('Allow', 'GET,POST,OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        response.setHeader('Access-Control-Allow-Origin', '*'); //Allowing cross domain/origin calls! https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS
        // res.setHeader('Content-Type', 'application/json');
        response.end('OK');
    }
    else
    {
        console.log('response did not catch what was sent');
    }
}


/*
 Initialize system
 */
initializeCell();


/*
    The sequence that handles stepping the pallet through the system
 */
function robotCellSequence()
{
    // log the variables monitored in the sequence
    console.log('stepIntoStep: ', stepIntoStep);
    console.log('currentlyInStep: ', currentlyInStep);
    console.log('cellZoneStates: ', cellZoneStates);
    console.log('robotDrawBusy: ', robotDrawBusy);
    console.log('robotPenChangeBusy: ', robotPenChangeBusy);
    console.log('******************************************');

    // Initialization of the sequence. Should be entered only during the startup of the server application
    if((stepIntoStep == 'init') && (currentlyInStep != stepIntoStep))
    {
        console.log(stepIntoStep, 'Step forward!');
        currentlyInStep = stepIntoStep;
        stepIntoStep = 'listenZ1';
    }
    // Application is listening to zone 1 to see if there is a pallet
    else if((stepIntoStep == 'listenZ1') && (currentlyInStep != stepIntoStep) && (cellZoneStates.zone1.state != '-1') && (cellZoneStates.zone2.state == '-1'))
    {
        //Done so that the sequence doesn't access here several times
        currentlyInStep = stepIntoStep;

        //Request data for the order from KB and if pallet is empty, link order with the pallet
        requestKBOrderData(cellZoneStates.zone1.state);

        console.log(stepIntoStep, 'Step forward!');

        console.log("currently working on following order");
        console.log(orderUnderWork);


        // If the cellphone is finished, there is nothing to do but transfer it to zone 4
        if(getPartToDraw() == 'ready') {
            performPost(conveyorDestinationHost, cellCode + "/services/TransZone14");

            currentPhone = {
                'frame' : "",
                'screen' : "",
                'keyboard' : ""
            };
            stepIntoStep = 'listenZ4';
        }
        // Phone is not ready, move it from zone 1 to zone 2
        else
        {
            performPost(conveyorDestinationHost, cellCode + "/services/TransZone12");

            stepIntoStep = 'listenZ2';
        }
    }
    // Application is waiting for the pallet to be available in zone 2. When the pallet is noticed there
    // it is necessary to check if the pen color matches what is required.
    else if((stepIntoStep == 'listenZ2') && (currentlyInStep != stepIntoStep)  && (cellZoneStates.zone2.state != '-1') && (cellZoneStates.zone3.state == '-1'))
    {
        currentlyInStep = stepIntoStep;
        console.log(stepIntoStep, 'Step forward!');
        currentPartToDraw = getPartToDraw(cellZoneStates.zone2.state);

        //color of the component is not used in this project
        //currentColorToUse = getPartColor(currentPartToDraw);
        console.log('currentPartToDraw: ', currentPartToDraw);

        performPost(conveyorDestinationHost, cellCode + "/services/TransZone23");

        stepIntoStep = 'listenZ3';

        // // Changing the pen color is not used in this project, so following section is commented out.
        // // The pen current color of the pen does not match what is required. Move to the change pen sequence.
        // if (currentColorToUse != getCurrentPenColor()) {
        //     performPost(robotDestinationHost, cellCode + "/services/PenChangeStarted");
        //
        //     stepIntoStep = 'listenPenChange';
        //      robotPenChangeBusy = true;
        // }
        // // The pen color is ok, move the pallet to zone 3.
        // else {
        //     performPost(conveyorDestinationHost, cellCode + "/services/TransZone23");
        //
        //     stepIntoStep = 'listenZ3';
        // }
    }
    // Wait for the pallet to be available on zone 3. When the pallet arrives
    else if((stepIntoStep == 'listenZ3') && (currentlyInStep != stepIntoStep)  && (cellZoneStates.zone3.state != '-1'))
    {
        currentlyInStep = stepIntoStep;
        console.log(stepIntoStep, 'Step forward!');

        performPost(robotDestinationHost, cellCode + "/services/" + partToCommand[currentPartToDraw]);
        robotDrawBusy = true;

        stepIntoStep = 'listenDraw';
    }
    // The pallet is on zone 3 and the robot is drawing. The application is waiting for the robot to finish
    else if((stepIntoStep == 'listenDraw') && (currentlyInStep != stepIntoStep) && (robotDrawBusy == false) && (cellZoneStates.zone3.state != '-1') && (cellZoneStates.zone4.state == '-1'))
    {
        currentlyInStep = stepIntoStep;
        console.log(stepIntoStep, 'Step forward!');

        performPost(conveyorDestinationHost, cellCode + "/services/TransZone35");

        stepIntoStep = 'listenZ5';
    }
    // The pallet is on zone 2 and the robot is changing the pen. The application is waiting for the robot to finish
    else if((stepIntoStep == 'listenPenChange') && (currentlyInStep != stepIntoStep) && (robotPenChangeBusy == false) && (cellZoneStates.zone2.state != '-1') && (cellZoneStates.zone3.state == '-1'))
    {
        currentlyInStep = stepIntoStep;
        console.log(stepIntoStep, 'Step forward!');

        performPost(conveyorDestinationHost, cellCode + "/services/TransZone23");

        stepIntoStep = 'listenZ3';
    }
    // The pallet is on transit from zone 1 to zone 4. The application is waiting for the pallet to arrive
    else if((stepIntoStep == 'listenZ4') && (currentlyInStep != stepIntoStep) && (cellZoneStates.zone4.state != '-1') && (cellZoneStates.zone5.state == '-1'))
    {
        currentlyInStep = stepIntoStep;
        console.log(stepIntoStep, 'Step forward!');

        performPost(conveyorDestinationHost, cellCode + "/services/TransZone45");

        stepIntoStep = 'listenZ5';
    }
    // The pallet is on transit to zone 5. The application is waiting for the pallet to arrive.
    else if((stepIntoStep == 'listenZ5') && (currentlyInStep != stepIntoStep)  && (cellZoneStates.zone5.state != '-1'))
    {
        currentlyInStep = stepIntoStep;
        console.log(stepIntoStep, 'Step forward!');

        console.log('currentPhone',currentPhone);
        console.log('sequence end');

        stepIntoStep = 'listenZ1';
    }
}



/*
    Initiates the server by subscribing to the events sent from the work cell
 */
function initializeCell()
{

    // getAvailableComponents("frame");
    // getAvailableComponents("screen");
    // getAvailableComponents("keyboard");

    //Subscribe to events on conveyor
    createSubscription(conveyorDestinationHost, cellCode + "/events/Z1_Changed/notifs");
    createSubscription(conveyorDestinationHost, cellCode + "/events/Z2_Changed/notifs");
    createSubscription(conveyorDestinationHost, cellCode + "/events/Z3_Changed/notifs");
    createSubscription(conveyorDestinationHost, cellCode + "/events/Z4_Changed/notifs");
    createSubscription(conveyorDestinationHost, cellCode + "/events/Z5_Changed/notifs");

    //subscribe to events on robot
    createSubscription(robotDestinationHost, cellCode + "/events/PenChangeStarted/notifs");
    createSubscription(robotDestinationHost, cellCode + "/events/PenChangeEnded/notifs");
    createSubscription(robotDestinationHost, cellCode + "/events/DrawStartExecution/notifs");
    createSubscription(robotDestinationHost, cellCode + "/events/DrawEndExecution/notifs");

    // Call sequence once to initialize it.
    robotCellSequence();
}


// Determine which parts the phone already has and which require work
function getPartToDraw()
{
    console.log('order under work: ', orderUnderWork);
    console.log('current phone: ', currentPhone);

    if(orderUnderWork.selectedFrame != currentPhone.frame)
    {
        return orderUnderWork.selectedFrame;
    }
    else if((orderUnderWork.selectedFrame == currentPhone.frame) && (orderUnderWork.selectedScreen != currentPhone.screen))
    {
        return orderUnderWork.selectedScreen;
    }
    else if((orderUnderWork.selectedFrame == currentPhone.frame) &&
        (orderUnderWork.selectedScreen == currentPhone.screen) &&
        (orderUnderWork.selectedKeyboard != currentPhone.keyboard))
    {
        return orderUnderWork.selectedKeyboard;
    }
    else if((orderUnderWork.selectedFrame == currentPhone.frame) &&
        (orderUnderWork.selectedScreen == currentPhone.screen) &&
        (orderUnderWork.selectedKeyboard == currentPhone.keyboard))
    {
        return 'ready';
    }
}


/*
    Function that is used to post commands to the controllers
 */
function performPost(destinationHost, command)
{
    console.log(destinationHost + command);
    var options = {
        method: 'post',
        body: {"destUrl": applicationHost + ":" + port}, // Javascript object
        json: true, // Use,If you are sending JSON data
        url: destinationHost + command,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    request(options, printResult);
}

/*
    Print the result sent as a response to the perform post command
 */
function printResult(err, res, body) {
    if (err) {
        console.log('Error :', err);
        return;
    }
    console.log(' Body :', body);
}

/*
    Function is used to analyze the events sent from the PLCs from the workcell
 */
function analyzeEvent(eventData)
{
    console.log(eventData);
    // Check if the notification was sent from the change of state of the zones
    if (eventData.id.indexOf('Z') == 0) {
        if (eventData.payload.hasOwnProperty('PalletID')) {

            if (eventData.id == 'Z1_Changed')
            {
                cellZoneStates.zone1.state = eventData.payload.PalletID;
            }
            if (eventData.id == 'Z2_Changed')
            {
                cellZoneStates.zone2.state = eventData.payload.PalletID;
            }
            if (eventData.id == 'Z3_Changed')
            {
                cellZoneStates.zone3.state = eventData.payload.PalletID;
            }
            if (eventData.id == 'Z4_Changed')
            {
                cellZoneStates.zone4.state = eventData.payload.PalletID;
            }
            if (eventData.id == 'Z5_Changed')
            {
                cellZoneStates.zone5.state = eventData.payload.PalletID;
            }
        }
    }
    // Check if the notification was sent from the change of state of the robot
    else if (eventData.id.indexOf('PenChangeStarted') == 0)
    {
        // the robot has started changing the pen. Mark the robot as busy.
        // The event is valid only when we are in the process of changing the pen
        if((currentlyInStep == 'listenPenChange') && (robotPenChangeBusy == false))
        {
            robotPenChangeBusy = true;
        }
    }
    else if (eventData.id.indexOf('PenChangeEnded') == 0)
    {
        // the robot has finished changing the pen. Mark the robot as available.
        // The event is valid only when we are in the process of changing the pen
        if((currentlyInStep == 'listenPenChange') && (robotPenChangeBusy == true))
        {
            robotPenChangeBusy = false;
        }
    }
    else if (eventData.id.indexOf('DrawStartExecution') == 0)
    {
        // the robot has started drawing. Mark the robot as busy.
        // The event is valid only when we are in the process of drawing the cellphone part
        if((currentlyInStep == 'listenZ3') && (robotDrawBusy == false))
        {
            // The robot is drawing the part. Update the phone under work with the part
            // if(eventData.payload.hasOwnProperty('Recipe'))
            // {
            //     updateCurrentPhone(eventData.Recipe);
            // }
            // else
            // {
            //     console.log('property not found!');
            // }
            robotDrawBusy = true;
        }
    }
    else if (eventData.id.indexOf('DrawEndExecution') == 0)
    {
        if((currentlyInStep == 'listenZ3') && (robotDrawBusy == true))
        {
            // The robot is drawing the part. Update the phone under work with the part
            if(eventData.payload.hasOwnProperty('Recipe'))
            {
                updateCurrentPhone(eventData.payload.Recipe);
            }
            else
            {
                console.log('property not found!');
            }

            robotDrawBusy = false;
        }
        else
        {
            console.log('does not meet requirements: ', currentlyInStep , ' ', robotDrawBusy);
        }
    }
    else
    {
        console.log('router.post, something went wrong with body!');
        console.log(eventData);
        console.log('*********************************************');
    }

    robotCellSequence();
}

/*
    Function updates the cellphone currently in progress.
 */
function updateCurrentPhone(recipe)
{

    //The robot sends the recipe it was drawing. Check the corresponding part from commandToPart JSON object
    var newPart = commandToPart[recipe];
    console.log('****updateCurrentPhone****');
    console.log(recipe, newPart);

    //Check which part was drawn and update the phone.
    if((newPart == 'frame_1') || (newPart == 'frame_2') || (newPart == 'frame_3')  )
    {
        currentPhone.frame = newPart;
    }
    else if((newPart == 'screen_1') || (newPart == 'screen_2') ||(newPart == 'screen_3'))
    {
        currentPhone.screen = newPart;
    }
    else if((newPart == 'keyboard_1') ||(newPart == 'keyboard_2') ||(newPart == 'keyboard_3'))
    {
        currentPhone.keyboard = newPart;
    }
}


/*
    Check that order has all the valid components in it
 */
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

/*
    Analyze the request sent from the user interface.
 */
function analyzeUiRequest(eventData)
{
    var response = {};
    // request was to place new order. Check the validity before accepting
    if(eventData.ui == 'newOrder')
    {
        if(eventData.hasOwnProperty('orderedPhone'))
        {
            if(validateOrder(eventData.orderedPhone))
            {
                insertOrder(eventData.orderedPhone);
                console.log('order is valid');
            }
            else
            {
                console.log('order is invalid');
            }
        }
    }
    else if(eventData.ui == 'maintenance')
    {
        if(eventData.hasOwnProperty('maintenanceCommand'))
        {
            if(eventData.maintenanceCommand == 'unsubscribeEvents')
            {
                deleteAllSubscriptions();
            }
            else if (eventData.maintenanceCommand == 'subscribeEvents')
            {
                initializeCell();
            }
            else if(eventData.maintenanceCommand == 'Calibrate')
            {
                performPost(robotDestinationHost, cellCode + "/services/" + eventData.maintenanceCommand);
            }
            else if(eventData.maintenanceCommand.indexOf('ChangePen') == 0)
            {
                performPost(robotDestinationHost, cellCode + "/services/" + eventData.maintenanceCommand);
            }
            else
            {
                performPost(conveyorDestinationHost, cellCode + "/services/" + eventData.maintenanceCommand);
            }

        }
    }
}

/*
    Insert order to KB
    
 */
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
                ///console.log(body);
                console.log("Order with id " , orderId, "added to the KB");
            });
        }
    }

}


//requestKBOrderData(cellZoneStates.zone1.state);

/*
    Function requests data from knowledge base bound to the pallet's RFID.
    If no order is bound to the pallet, link next order from the queue to the pallet
 */
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


/*
 Add subscription to event sent by the controller. If no errors were found, adds the subscription ID
 to the notificationIDs json. The key is the event url that was subscribed to.
 */
function createSubscription(destinationHost, command)
{
    console.log(destinationHost + command);
    var options = {
        method: 'post',
        body: {"destUrl": applicationHost + ":" + port}, // Javascript object
        json: true, // Use,If you are sending JSON data
        url: destinationHost + command,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    request(options, function(err, res, body) {
        if (err) {
            console.log('Error :', err);
            return;
        }
        notificationIDs[destinationHost+command] = body.id;
        console.log(' Body :', body);
    });
}


/*
    Deletes all subscriptions from the PLCs
 */
function deleteAllSubscriptions()
{
    deleteSubscription(conveyorDestinationHost, cellCode + "/events/Z1_Changed/notifs");
    deleteSubscription(conveyorDestinationHost, cellCode + "/events/Z2_Changed/notifs");
    deleteSubscription(conveyorDestinationHost, cellCode + "/events/Z3_Changed/notifs");
    deleteSubscription(conveyorDestinationHost, cellCode + "/events/Z4_Changed/notifs");
    deleteSubscription(conveyorDestinationHost, cellCode + "/events/Z5_Changed/notifs");

    //subscribe to events on robot
    deleteSubscription(robotDestinationHost, cellCode + "/events/PenChangeStarted/notifs");
    deleteSubscription(robotDestinationHost, cellCode + "/events/PenChangeEnded/notifs");
    deleteSubscription(robotDestinationHost, cellCode + "/events/DrawStartExecution/notifs");
    deleteSubscription(robotDestinationHost, cellCode + "/events/DrawEndExecution/notifs");
}

/*
 delete subscription from the controller. If we have subscription id for the event (held in the notificationIDs
 variable) function sends http request with method delete to the controller and updates the subscription json.
 */
function deleteSubscription(destinationHost, command)
{
    if(notificationIDs.hasOwnProperty(destinationHost + command))
    {
        var options = {
            method: 'delete',
            body: {"destUrl": applicationHost + ":" + port}, // Javascript object
            json: true, // Use,If you are sending JSON data
            url: destinationHost + command + "/" + notificationIDs[destinationHost+command],
            headers: {
                'Content-Type': 'application/json'
            }
        };

        request(options, function (err, res, body)
        {
            if (err)
            {
                console.log('Error :', err);
                return;
            }
            // remove notification also from the JSON object
            delete notificationIDs[destinationHost + command];
        });
    }
}


