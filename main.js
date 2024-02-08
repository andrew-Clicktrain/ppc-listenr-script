/**
*
* The Ultimate Change History MCC Script
*
* The script checks all the entries in the Google Ads change history of your accounts and installed at the MCC level, 
* and if there is a change by a user outside of your list of 'recognized' users or your 'domain', you will get an alert via email.
* The alert mail contains the number of changes as well as a link to the Google Sheet that lists all changes by unrecognized users.
*
* 
* @initalAuthor: Nils Rooijmans
* 
* Branched Version 2.0
* @author: Andrew Bloch
* 
* For more features like specific user insights and predicted hours visit - ppclistenr.com
*/


// CHANGE SETTINGS HERE

var spreadsheetId = ""; // Insert the ID of the new blank main spreadsheet between the double quotes
var emailAddresses = "andrew@test.com"; 
var yourDomain = "test.com"; 

var ignoreUsers = [
  'john@doe.com'
];

// NOTE: if you want to add multiple users, one per line, with a comma separating the lines. I.e.:
// var ignoreUsers = [
// 'john@doe.com',
// 'jane@doe.com',
// 'jill@johns.com'
// ];

var sendMail = true;
var emailSubject = "PPCListenr - WARNING - Change by person outside of the Agency";
var emailBody =
  "\n" +
  "***\n" +
  "\n" +
  "This script checks changes in the 'Change history':\n" +
  "\n" +
  "For all changes during " + period + "\n" +
  "   check if there is a change being made by users other than " + ignoreUsers + "\n" +
  "   if so, alerts are logged in Google Sheet: https://docs.google.com/spreadsheets/d/" + spreadsheetId + "\n" +
  "\n" +
  "If there is an alert, an email is sent to:\n" + emailAddresses + "\n";

var period = "YESTERDAY";

function main() {

    prepareOutputSheet(true) 

    var ids = [];   
    var accounts = MccApp.accounts().get();
    while (accounts.hasNext() && ids.length < 50) {
      var account = accounts.next();
      var customerId = account.getCustomerId();
    
        ids.push(customerId);
      
    }

  
    MccApp.accounts().withIds(ids).executeInParallel(
      'getChangeAlerts')
  }


function getChangeAlerts() {

    var accountName = AdsApp.currentAccount().getName();
  
    var changeAlerts = [];
  
    var query = "SELECT " +
      "campaign.name, " +
      "change_event.change_date_time, " +
      "asset.type, " +
      "change_event.change_resource_type, " +
      "change_event.changed_fields, " +
      "change_event.user_email " +
      "FROM change_event " +
      "WHERE change_event.change_date_time DURING " + period + " " +
      "AND change_event.user_email NOT REGEXP_MATCH '.*@" + yourDomain + "' " +
      "AND change_event.user_email NOT IN ('"+ignoreUsers.join("', '")+"') "+
      "AND change_event.client_type IN ('GOOGLE_ADS_RECOMMENDATIONS', 'GOOGLE_ADS_WEB_CLIENT')" +
      "ORDER BY change_event.change_date_time DESC " +
      "LIMIT 9999 "; // Max of 10k changes reported per request
  

    try {
      var result = AdsApp.search(query);
    } catch (e) {
      alert("Issue retrieving results from search API: " + e);
    }
    var lastResult = ""
    while (result.hasNext()) {
      var row = result.next();
      
      var campaignName = "";
      var assetType = "";
  
      try {
        campaignName = row.campaign.name;
      } catch (e) {}

      try {
        assetType = row.asset.type;
      } catch (e) {}
  

      if (!campaignName && assetType){
        campaignName = assetType
      }
      try {
        var change = [
          row.changeEvent.changeDateTime,
          accountName,
          row.changeEvent.userEmail,
          campaignName,
          row.changeEvent.changeResourceType,
          row.changeEvent.changedFields,
        ];

        var thisResult = JSON.stringify( change[2] + change[3] + change[4] + change[5]  )
        
        if ( thisResult != lastResult ){
          changeAlerts.push(change)
          lastResult = thisResult 
        } 

      } catch (e) {
        Logger.log("Issue with parsing results from search API: " + e);
      }
  
    }
       
        if (changeAlerts.length > 0) {
          reportResults(changeAlerts);
          sendEmail(changeAlerts.length);
        }
  }


function addHeaderToOutputSheet(sheet) {

  var header = [
    "Date",
    "Account",
    "User",
    "Location",
    "Type",
    "Fields",
  ];

  sheet.appendRow(header);
}


function reportResults(changes) {
    let sheet = prepareOutputSheet(false);
    addOutputToSheet(changes, sheet);
}


function prepareOutputSheet(clear) {

    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    if (!spreadsheet) {
      alert("Cannot open new reporting spreadsheet");
      return;
    }
    var sheet = spreadsheet.getActiveSheet();
    if (!sheet) {
        alert("Cannot open new reporting sheet") ;
        return ;
    }  

    if (clear){
        sheet.clearContents();
        addHeaderToOutputSheet(sheet);
       // sheet.insertRowsBefore(2, output.length); // add empty rows below header row
     }
    return sheet;
     
}


function addOutputToSheet(output, sheet) {
  
  
 
    var numberOfRows = sheet.getLastRow() ;
     
    var startRow = numberOfRows + 1;
     
    var range=sheet.getRange(startRow, 1, output.length, output[0].length) ;
    range.setValues(output) ; 
   
    Logger.log("\nNumber of rows added to output sheet: "+output.length+"\n\n");
     
  }
  



function sendEmail(numberOfAlerts) {

  var accountName = AdsApp.currentAccount().getName();

  if (sendMail) {

    var emailBody =
      "Number of changes: " + numberOfAlerts + "\n" +
      "See details: https://docs.google.com/spreadsheets/d/" + spreadsheetId + "\n" + emailBody;

    MailApp.sendEmail(emailAddresses, emailSubject + " | " + accountName, emailBody);
    Logger.log("Sending alert mail");
  }
}

function alert(string) {
  Logger.log("### " + string);
}
