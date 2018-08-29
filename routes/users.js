var express = require('express');
var router = express.Router();

// order

router.get('/order',function(req,res){

	res.render('order');
});


var ocus_name;

var ocus_phone;

var oFrame;

var oFrame_color;

var oScreen;

var oScreen_color;

var oKeyboard;

var oKeyboard_color;

function setOFrame(Frame) {

    if (Frame==1||Frame==2||Frame==3){

        oFrame=Frame;

        console.log("Frame type "+Frame);
 
   }
    
else 
{
        
console.log("something wrong with Frame type")
    
}

}

function setOFrame_color(Frame_color) {

    oFrame_color=Frame_color;

    console.log(oFrame_color);

}

function setOScreen(Screen) {

    if(Screen==4){

        oScreen=Screen;

        console.log("Screen type 1");
}
    else if(Screen==5){

        oScreen=Screen;
 
       console.log("Screen type 2");}
  
  else if(Screen==6){

        oScreen=Screen;
 
       console.log("Screen type 3");
}
 
   else{console.log("something wrong with Screen type")}

}

function setOScreen_color(Screen_color) {

    oScreen_color=Screen_color;

    console.log(oScreen_color);

}

function setOKeyboard(Keyboard) {

    if(Keyboard==7){

        oKeyboard=Keyboard;

        console.log("Keyboard type 1");
}
    else if(Keyboard==8){
 
       oKeyboard=Keyboard;
 
       console.log("Keyboard type 2");
}
 
   else if(Keyboard==9){
  
      oKeyboard=Keyboard;
 
       console.log("Keyboard type 3");
}
    else {
console.log("something wrong with Keyboard type")}

}

function setOKeyboard_color(Keyboard_color) {

    oKeyboard_color=Keyboard_color;

    console.log(oKeyboard_color);

}


function setOcus_name(cus_name){

    ocus_name=cus_name;

    console.log(ocus_name);

}

function setOcus_phone(cus_phone){

    ocus_phone=cus_phone;

    console.log(ocus_name);

}

function getOFrame(){

    return oFrame;

}

router.post('/order',function(req,res){

	
	console.log('REQUEST: ',req);
	console.log('REQUEST.body: ',req.body); //req.body.option[0]
	 var cus_phone=req.body.cus_phone;

    var cus_name=req.body.cus_name;
   
 var Frame = req.body.Frame;
 
   var Frame_color = req.body.Frame_color;
 
   var Screen = req.body.Screen;
 
   var Screen_color = req.body.Screen_color;
 
   var Keyboard = req.body.Keyboard;
 
   var Keyboard_color = req.body.Keyboard_color;
   res.end();
 
});

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



module.exports = router;
