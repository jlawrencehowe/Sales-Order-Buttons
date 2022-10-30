/**
 * ADV - UE - Sales Order Buttons.js
 *
 * @NScriptType UserEventScript
 * @NApiVersion 2.x
 * @author: Jacob Howe
 * Purpose: Consolidation of previous buttons on Sales Order page. Generates related buttons
 * Update: 2021/10/29 = JLH BSD-56632 to check if terms is Credit Card to not let it release
 * Update: 2021/12/21 = JLH BSD-57760 Included credit card approval check and prevent Sales Order Release logic from firing if not in view/edit
 * Update: 2022/01/28 = JLH BSD-59095 Exception on validation status check for release SO button. If WLM46, then don't check.
 * Update: 2022/03/08 = JLH BSD-60095 Hold SO Button and Release SO Button will both appear on Rollback Complete Status
 * Update: 2022/04/04 = JLH BSD-60625 Adds a check to the SO Release button if any lines are overcommited
 * Update: 2022/05/04 = JLH BSD-60928 Added Order Close button
 * Update: 2022/05/06 = JLH BSD-61155 Added check for Hold Order button to look at custbody_adv_edi940_sent, if it is checked, disable button
 * Update: 2022/09/01 = JLH BSD-61638 Added button for update Header Fields and added check to block button if the order is closed to free up space
 * Update: 2022/09/22 = JLH BSD-64174 Changed Release button requirement to use Fill Order Rule from SO instead of Customer
 * Update: 2022/10/11 = JLH PMA-67    Added button for printing international docs
 */
define(['N/runtime', 'N/ui/serverWidget', 'N/url', 'N/https', 'N/record', 'N/search', 'N/ui/dialog', 'N/ui/message'], 


	function(runtime, serverWidget, url, https, record, search, dialog, message) {

		const _SCRIPT_ID = "customscript_adv_print_usmca_sl";
        const _DEPLOY_ID = "customdeploy_adv_print_usmca_sl";
		const _ADMIN_ROLE_NUM = 3;
		const _FACILITIES_LEAD_NUM = 1057;
		const _FACILITIES_STAFF_NUM = 1033;
		const _FACILITIES_ORDER_MANAGEMENT_NUM = 1050;
		const _PRO_FORMA_TEMPATE_ID = 119;
		const _SAMPLE_ORDER_ID = "211"
		const _DSDC_FULFILL_PATH = '3';
		const _EDI_ORDER_SOURCE = 1;
		const _ADV_RESERVATION_FORM = 169;
		const _ADVANTUS_ROUTING_GUIDE = 12583;
		const _CUSTOMER_ROUTING_GUIDE = 12821;
		
		
		function beforeLoad(context) {
			var ID = context.newRecord.id;
			var transID = context.newRecord.getValue({fieldId: "tranid"});
			var form = context.form;
			
			var myStatus = context.newRecord.getValue({fieldId:"status"});
			var userRole = runtime.getCurrentUser().role;
			 
			//log.debug("SO View Type", context.type);	 
			//Original Script: ADV - Sales Order Buttons     https://5050497.app.netsuite.com/app/common/scripting/script.nl?id=1302
			
          	// Hide cancel order button ... We want users to cancel orders via the drop down
          	//Unhid button for Admins - BD requested 12/23/2021
			if (userRole != _ADMIN_ROLE_NUM) {
				context.form.removeButton({id:"cancelorder"});
			}
			
			
          
			salesOrderButtTry: try {
          
				// Only show if the Record is in View Mode
				if(context.type == context.UserEventType.VIEW) {
					//PG FEB 22 2021
					//hide the fulfill button if the form is ADV - Sample Order && location is in 1, 6, 9, 240, 230, 229, 228
					//1 = 12th street, 6 = Petersburg : Petersburg Bldg 1-6, 9 = 12th Street : E-Com Building,
					//240 = Petersburg : Petersburg Bldg 7-8, 230 = Shawland : Shawland Bldg H-I, 229 = Shawland : Shawland Bldg K, 228 = Shawland : Shawland Bldg L
					var disallowedLocations = ["1", "6", "9", "240", "230", "229", "228"]
				
					var searchData = search.lookupFields({
						type: search.Type.SALES_ORDER,
						title: 'salesorder',
						id: ID,
						columns: ['customform', 'location', 'shipmethod'],
					});
					
					var myShipMethod = searchData.shipmethod;
					
				 
					if (searchData.customform == _SAMPLE_ORDER_ID || disallowedLocations.indexOf(searchData.location) >= 0) {
						try{
							if (userRole != _ADMIN_ROLE_NUM) {
                          		var button = form.getButton("process");
								button.visible = false;
                            }
						}
						catch(e){
							log.error("ERR - Get Process Button", "Unexpected Error:  " + e);
						}
					}
					
				//log.debug("****SO FORM", searchData.customform);	  
						  
				}

				  

				
				
				
				  
				var myForm = context.newRecord.getValue({fieldId:"customform"});
				if (myForm == _ADV_RESERVATION_FORM) {
					// break try if it's the ADV - Reservation form (for inventory reservations)
					break salesOrderButtTry;
				}
				  
		  
				if (context.type == context.UserEventType.VIEW) {
              
					// ADD PRO FORMA INVOICE BUTTON
					var myTemplateId = _PRO_FORMA_TEMPATE_ID;	// Pro Forma Invoice Template Internal ID
					
					// Document Suitelets
					// Despite being labeled for item fulfillments and DI docs, I think this will work on Sales Orders, as well.
					var suiteletURL = url.resolveScript({scriptId: 'customscript_rsm_slt_if_print_di_docs', deploymentId: 'customdeploy_rsm_slt_if_print_di_docs'});
						suiteletURL += '&rectype=' + context.newRecord.type + '&recid=' + ID + '&templateid=' + myTemplateId;

					//log.debug("suiteletURL", suiteletURL);

					var myLink = "window.open('" + suiteletURL + "', 'Print Pro Forma Invoice', 'width=1200,height=500,directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=no');";

					form.addButton({
						id : 'custpage_print_pfi',
						label : 'PFI',
						functionName : myLink
					});


					// ADD VIEW EDI850 BUTTON
					var mySource = context.newRecord.getValue({fieldId:"custbody_adv_order_source"});
					if (mySource == _EDI_ORDER_SOURCE) {		// order source of 1 = EDI order
						var ediPoUrl = 'http://newton.advantus.com/EDIPOLookup/?po=' + context.newRecord.getValue({fieldId:"otherrefnum"});
						//log.debug("Pro Forma Invoice Suitelet URL", pfiStatementUrl);
				
						myLink = "window.open('" + ediPoUrl + "', 'View EDI 850', 'width=1200,height=700,directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=no');";
				
						form.addButton({
							id : 'custpage_view_edipo',
							label : 'EDI',
							functionName : myLink
						});
					}
				
					
					// Pull Customer Preferences
					var preferences = search.lookupFields({
						type: search.Type.CUSTOMER,
						title: 'customer',
						id: context.newRecord.getValue({fieldId:"entity"}),
						columns: ['custentity_adv_so_label_template'],
					});
					//log.debug("preferences", preferences.custentity_adv_so_label_template);
					
					// ADD SALES ORDER LABEL BUTTON (if one is defined)
					if (Object.keys(preferences.custentity_adv_so_label_template).length != 0) {
						myTemplateId = preferences.custentity_adv_so_label_template[0].value;
						
						
						var suiteletURL = url.resolveScript({scriptId:'customscript_adv_suitelet_solabels_scr', deploymentId: 'customdeploy_adv_suitelet_solabels_dep'});
						suiteletURL += '&rid=' + ID + '&templateid=' + myTemplateId;

						//log.debug("suiteletURL", suiteletURL);


						myLink = "window.open('" + suiteletURL + "', 'Print SO Lbls', 'width=1200,height=500,directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=no');";
				
						form.addButton({
							id : 'custpage_print_solbl',
							label : 'Print SO Lbls',
							functionName : myLink
						});


					}
				}
          
				// ADD REFRESH SO ITEM DATA BUTTON (Refresh Prices, ADV - Customer Item Detail information, etc.)
		   
				if (myStatus == 'Pending Approval' || myStatus == 'Pending Fulfillment' || userRole == _ADMIN_ROLE_NUM && myStatus != 'Closed') {		
					
					var suiteletURL = url.resolveScript({scriptId:'customscript_adv_suitelet_updatesoprice', deploymentId: 'customdeploy_adv_suitelet_updprice_depl'});
					suiteletURL +=  '&m=so&rid=' + ID;

					//log.debug("suiteletURL Item Data", suiteletURL);


					//myLink = "if(dialog.confirm('This will refresh all Customer Item Detail information and pricing information on all order lines for this order and may take some time to run.  Are you sure?')){window.location.assign('https://5050497.app.netsuite.com" + suiteletURL + "');}";
					myLink = "window.location.assign('https://5050497.app.netsuite.com" + suiteletURL + "');";
				
					form.addButton({
						id : 'custpage_upd_so_price',
						label : 'Item Data',
						functionName : myLink
					});
		  
		  
				}
				
				
          
				
				// ADD GET LTL RATES BUTTON
				
				
				var myMode = "V";
				if (context.type == context.UserEventType.EDIT) {
					myMode = "E";
				} 
	  
              if(myStatus != 'Closed'){

                  var suiteletURL = url.resolveScript({scriptId:'customscript_adv_suitelet_gettirates', deploymentId: 'customdeploy_adv_suitelet_dep_gettirates'});
                  suiteletURL += '&t=SalesOrder&rid=' + ID + '&m=' + myMode;

                  //log.debug("suiteletURL", suiteletURL);


                  myLink = "window.open('" + suiteletURL + "', 'Get LTL Rates', 'width=1200,height=500,directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=no');";

                  form.addButton({
                      id : 'custpage_getltlrates',
                      label : 'LTL Rates',
                      functionName : myLink
                  });
            }
		  
          
			}
			catch (e) {
				log.error("salesOrderButtTry", "Unexpected Error:  " + e);
			}
			 
			
			
			//Original Script: ADV_SO_Print_Barcode_UE	     https://5050497.app.netsuite.com/app/common/scripting/script.nl?id=1398
			printBarcodeTry: try {

				// For development
				// var user = runtime.getCurrentUser();
				// if (user.id != '6010') { return; }

				// 'Order Fulfillment Path' field should be 'DSDC'
				var fulfillPath = context.newRecord.getValue('custbody_adv_order_fulfillment_path');
				
				// Only show if the Record is in View Mode and fulfullPath is 3
				if ((context.type !== context.UserEventType.VIEW || fulfillPath != _DSDC_FULFILL_PATH)) {break printBarcodeTry; };
				//Only show if User role is one of the following
				if ((userRole != _ADMIN_ROLE_NUM && userRole != _FACILITIES_LEAD_NUM && userRole != _FACILITIES_STAFF_NUM && userRole != _FACILITIES_ORDER_MANAGEMENT_NUM)) {break printBarcodeTry; };
				

				// Get suitelet url to call
				var suiteletURL = url.resolveScript({scriptId:'customscript_adv_so_print_barcode_sl', deploymentId: 'customdeploy_adv_so_print_barcode_sl'});
				suiteletURL += '&rectype=' + context.newRecord.type + '&recid=' + ID;

				//log.debug("suiteletURL", suiteletURL);

				myLink = "window.open('" + suiteletURL + "', 'Print Barcodes', 'width=1200,height=500,directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=no');";
				
				form.addButton({
					id : 'custpage_print_barcodes',
					label : 'Print Barcodes',
					functionName : myLink
				});
			}
			catch (e) {
				log.error("addPrintBarcodes", "Unexpected Error:  " + e);
			}
			
			
			//Release Order Button
			try {
			//User role 1057 = Facilities Lead, 1050 = Facilities Lead, Order Management
				if(userRole != _FACILITIES_LEAD_NUM && userRole != _FACILITIES_ORDER_MANAGEMENT_NUM && myStatus != 'Closed'){
					//Updated to prevent error when creating new SO - JLH - 2021/12/21
					if(context.type == context.UserEventType.VIEW || context.type == context.UserEventType.EDIT){
						
						//if released, then grey out button released = 3 hold = 1 rollbackcomplete = 7 scheduled = 2
						var orderReleaseStatus = context.newRecord.getValue('custbody_adv_order_release_status');
						var edi940_850Sent = context.newRecord.getValue('custbody_adv_edi940_sent');
							log.debug('edi940_850Sent', edi940_850Sent);
						//If released, look at set SO to HOLD logic
						if(orderReleaseStatus == 3 || orderReleaseStatus == 7){
							//Search to see if SO is valid for setting to HOLD
							var okToHoldSearch = search.load({
								id: 'customsearch_ok_to_hold_so', //***SCRIPT-Orders OK to Move Back to Hold (BD)
							});
							//Add filter for current SO
							var soIdFilter = search.createFilter({
								name: 'internalidnumber',
								operator: 'equalto',
								values: ID
							});
							
							okToHoldSearch.filters.push(soIdFilter);
							
							var soList = okToHoldSearch.run().getRange({start: 0, end: 1});
							log.audit ('soList', soList.length);
							//var temp = JSON.stringify(soList)
							
							var fulfillmentPath = context.newRecord.getValue('custbody_adv_order_fulfillment_path');
							//Used for knowing if needed to check for tasks
							var isTaskPicking = 'f';
							if(fulfillmentPath == 1){
								isTaskPicking = 't';
							}
							var suiteletURL = url.resolveScript({scriptId:'customscript_adv_suitelet_setsostathold', deploymentId: 'customdeploy_adv_suitelet_setsostathold'});
								suiteletURL += '&rectype=' + context.newRecord.type + '&recid=' + ID + '&transid=' + transID + '&isTaskPicking=' + isTaskPicking;

							//log.debug("suiteletURL", suiteletURL);

							//myLink = "window.open('" + suiteletURL + "', 'Release SO', 'width=1200,height=500,directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=no');";
							myLink = "window.location.assign('https://5050497.app.netsuite.com" + suiteletURL + "');";
							var releaseOrderButton = form.addButton({
								id : 'custpage_hold_so',
								label : 'Hold SO',
								functionName : myLink
							});
							//If nothing is returned from the search, disable the button
							if(soList.length == 0 || edi940_850Sent){
								releaseOrderButton.isDisabled = true;
							}
						}
						if(orderReleaseStatus != 3){
								
							
							
							//must be passed 3 = passed
							var validationStatus = context.newRecord.getValue('custbody_adv_order_validation');
							//Included check to ignore validation status for 46WLM as we do not set validation for that customer - JLH - 2022-01-28 - BSD-59095
							if(context.newRecord.getValue('entity') == 3055){
								validationStatus = 3;
							}
							//must be approved
							var approvalStatus = myStatus;
							//1 = pending, 2 = partial, 3 = full
							var allocationStatus = context.newRecord.getValue('custbody_adv_allocation_status');
							//if released, then grey out button released = 3 hold = 1 rollbackcomplete = 7 scheduled = 2
							//var orderReleaseStatus = context.newRecord.getValue('custbody_adv_order_release_status');
							var paymentMethod = context.newRecord.getValue('paymentmethod');
							var terms = context.newRecord.getValue('terms');
							//Results of if Credit Card is approved
							var creditCard = context.newRecord.getValue('paymenteventresult');
								
							var orderLineFillRules = context.newRecord.getValue('custbody_adv_cust_fill_rel_rule');
								
						
							var isAllocated = false;
							if(orderLineFillRules.length == 0 || orderLineFillRules == 1){
								if(allocationStatus == 3){
									isAllocated = true;
								}
							}
							else if(allocationStatus == 3 || allocationStatus == 2){
								isAllocated = true;
							}
						
							var suiteletURL = url.resolveScript({scriptId:'customscript_adv_suitelet_updsoreleasest', deploymentId: 'customdeploy_adv_suitelet_updsoreleasest'});
								suiteletURL += '&rectype=' + context.newRecord.type + '&recid=' + ID;

							//log.debug("suiteletURL", suiteletURL);

							myLink = "window.location.assign('https://5050497.app.netsuite.com" + suiteletURL + "');";
							var releaseOrderButton = form.addButton({
								id : 'custpage_release_SO',
								label : 'Release',
								functionName : myLink
							});
						
							var paymentapproved = false;
							 if(paymentMethod == ""){
							   var paymentapproved = true;
							 }
							else if(paymentMethod != "" && search.lookupFields({type:record.Type.SALES_ORDER, id: ID, columns:["paymentapproved"]}).paymentapproved){
								var paymentapproved = true;
							}
							
							var acceptedCard = true;
							if(!!paymentMethod){
								//Included to check if Credit Card is approved or not - JLH - 2021/12/21 - BSD-57760
								//Type 1 = PaymentCard
								var paymentmethodSearchObj = search.create({
								   type: "paymentmethod",
								   filters:
								   [
										["internalid","anyof",paymentMethod],
										"AND", 
										["type","anyof","1"]
								   ],
								   columns:
								   [
									  search.createColumn({
										 name: "name",
										 sort: search.Sort.ASC,
										 label: "Name"
									  })
								   ]
								});
								var paymentmethodSearchList = paymentmethodSearchObj.run().getRange({start: 0, end: 1000});
								//log.debug('test', paymentmethodSearchList);
								if(paymentmethodSearchList.length > 0){
									
									if(!creditCard || creditCard == 'ACCEPT'){
										acceptedCard = true;
									}
									else{
										acceptedCard = false;
									}
								}
							}
							//Check if conditions are filled to activate or deactivate button
							//Added release status of scheduled to be okay to release
							if((validationStatus == 3 && (approvalStatus == "Pending Fulfillment" || approvalStatus == "Pending Billing/Partially Fulfilled" || approvalStatus == "Partially Fulfilled") && isAllocated) && (orderReleaseStatus == '1' || orderReleaseStatus == '7' || orderReleaseStatus =='2') && paymentapproved && terms != 50 && acceptedCard){
								
								releaseOrderButton.isDisabled = false;
							}
							else{
								releaseOrderButton.isDisabled = true;
							}
							//Disables button if any lines are overcommitted - BSD-60625 - JLH - 2022/04/04
							if(!releaseOrderButton.isDisabled && validateOverCommittedLines(ID)){
								releaseOrderButton.isDisabled = true;
							}
							
							// Disable button if Ship Via is ARG or CRG
							if (!releaseOrderButton.isDisabled && (myShipMethod == _ADVANTUS_ROUTING_GUIDE || myShipMethod == _CUSTOMER_ROUTING_GUIDE)) {
								releaseOrderButton.isDisabled = true;
							}
							
							// Disable button if Hold Reason or Hold Note are setActive
							if (!releaseOrderButton.isDisabled && (context.newRecord.getValue({fieldId:"custbody_adv_hold_reason"}).length > 0 || context.newRecord.getValue({fieldId:"custbody_adv_hold_note"}).length > 0)) {
								releaseOrderButton.isDisabled = true;
							}
						}
						
					}
				}
			} catch (e) {
					log.error("addSOReleaseButton", "Unexpected Error:  " + e);
			}
			
			
			
          
          //Added removal of fulfillbutton if fulfillment path is Task Picking, DSDC, or Bulk Fulfillment - JLH - BSD-58687 - 2022/01/04
          //1 = Task Picking   2 = Bulk Fulfillment   3 = DSDC
			try{
				var fulfillmentPath = context.newRecord.getValue({fieldId:"custbody_adv_order_fulfillment_path"});
              	log.audit("Fulfillment Path", fulfillmentPath)
				if(fulfillmentPath == 1 || fulfillmentPath == 2 || fulfillmentPath == 3){
					if (userRole != _ADMIN_ROLE_NUM) {
						context.form.removeButton({id:"process"});
					}
				}
			}
			catch (e){
					log.error("addSOReleaseButton", "Unexpected Error:  " + e);
			}
			
			//Close Order Button
			//User role 1057 = Facilities Lead, 1050 = Facilities Lead, Order Management
			if((context.type == context.UserEventType.VIEW || context.type == context.UserEventType.EDIT) && userRole != _FACILITIES_LEAD_NUM && userRole != _FACILITIES_ORDER_MANAGEMENT_NUM && myStatus != 'Closed') {
				try{
					var orderCloseReason = context.newRecord.getValue('custbody_adv_so_ordercancel_reason');
					var orderStatus = context.newRecord.getValue('status');
					if(orderCloseReason != '' && orderStatus != 'Closed'){
						
						var myMsg = message.create({
							title: "Scheduled to Close",
							message: 'This Sales Order is currently scheduled to be closed. A process should run every 15 minutes. If this order is scheduled and has not been closed after 15 minutes have passed. Please contact IT.',
							type: message.Type.WARNING,
							duration: 500000
					   });
					   context.form.addPageInitMessage({message: myMsg});
						
					}
					const ORDEROKTOCANCEL = 10196; //***SCRIPT-Orders OK to Cancel (JLH)
					var orderOkToCancelSearch = search.load({
						id: ORDEROKTOCANCEL
					});
					
					var soIdFilter = search.createFilter({
								name: 'internalidnumber',
								operator: 'equalto',
								values: ID
							});
							
					orderOkToCancelSearch.filters.push(soIdFilter);
					
					var soList = orderOkToCancelSearch.run().getRange({start: 0, end: 1});
					var fulfillmentPath = context.newRecord.getValue('custbody_adv_order_fulfillment_path');
							//Used for knowing if needed to check for tasks
							var isTaskPicking = 'f';
							if(fulfillmentPath == 1){
								isTaskPicking = 't';
							}
							
					var myRecord = context.newRecord;
					var woReleased = false;
				var lines = myRecord.getLineCount({
					sublistId: "item"
				});
				var woNums = ''
				if (lines > 0) {
					for (var lineCtr = 0; lineCtr < lines; lineCtr++) {
						var woID = myRecord.getSublistValue({sublistId: "item", fieldId: "woid", line: lineCtr});
						
						if(!!woID){
							var fieldLookUp = search.lookupFields({
								type: search.Type.WORK_ORDER,
								id: woID,
								columns: ['status', 'tranid']
							});
							
							
							if(fieldLookUp.status != 'A'){
								woReleased = true;
							}
							else{
								woNums += fieldLookUp.tranid + ', ';
							}
						}
					}
					
				}
			
					var customerName = context.newRecord.getText({fieldId: "entity"});
					customerName = customerName.replace("'", "");
					var suiteletURL = url.resolveScript({scriptId:'customscript_adv_suitelet_cancelso', deploymentId: 'customdeploy_adv_suitelet_cancelso'});
								suiteletURL += '&rectype=' + context.newRecord.type + '&recid=' + ID + '&isTaskPicking=' + isTaskPicking + '&soNum=' + context.newRecord.getText({fieldId: "tranid"}) + '&custName=' + customerName + '&woNums=' + woNums;
					//myLink = "window.open('https://5050497.app.netsuite.com" + suiteletURL + "', 'Cancel Sales Order', 'width=800,height=500,directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no,scrollbars=no,resizable=no');";
					
					myLink = "window.location.assign('https://5050497.app.netsuite.com" + suiteletURL + "');";
					var releaseOrderButton = form.addButton({
						id : 'custpage_cancel_SO',
						label : 'Close',
						functionName : myLink
					});
					if(soList < 1){
						releaseOrderButton.isDisabled = true;
					}
				}
				catch(e){
					log.error("Close Order Button Error", "Unexpected Error:  " + e);
				}
			}
			
			//Re-Open SO Button
			//User role 1057 = Facilities Lead, 1050 = Facilities Lead, Order Management
			if((context.type == context.UserEventType.VIEW || context.type == context.UserEventType.EDIT) && userRole != _FACILITIES_LEAD_NUM && userRole != _FACILITIES_ORDER_MANAGEMENT_NUM) {
				try{
					
					var orderReleaseStatus = context.newRecord.getValue('custbody_adv_order_release_status');
					var orderStatus = context.newRecord.getValue('status');
					log.audit('test', orderStatus);
					if(orderStatus == 'Closed'){	
						var myRecord = context.newRecord;
							var customerName = context.newRecord.getValue({fieldId: "custbody_adv_if_entityid"});
							var customerId = context.newRecord.getValue({fieldId: "entity"});
							
							var suiteletURL = url.resolveScript({scriptId:'customscript_adv_sl_reopenso', deploymentId: 'customdeploy_adv_sl_reopenso'});
										suiteletURL += '&rectype=' + context.newRecord.type + '&recid=' + ID + '&soNum=' + context.newRecord.getText({fieldId: "tranid"}) + '&custId=' + customerId + '&custName=' + customerName;
							
							myLink = "window.location.assign('https://5050497.app.netsuite.com" + suiteletURL + "');";
							var reopenOrderButton = form.addButton({
								id : 'custpage_cancel_SO',
								label : 'Re-Open SO',
								functionName : myLink
							});
					}
				}
				catch(e){
					log.error("Close Order Button Error", "Unexpected Error:  " + e);
				}
			}
			
			//Print International Docs
			//User role 1057 = Facilities Lead, 1050 = Facilities Lead, Order Management
			if((context.type == context.UserEventType.VIEW || context.type == context.UserEventType.EDIT)) {
				try{
					
                  	var showButton = true;
                  	
					var myCountry = context.newRecord.getValue({fieldId: 'shipcountry'});
					if (myCountry == "US") {
					  showButton = false;
					}
                    showButton = true;
					
                  	if (showButton) {
                      var URL = url.resolveScript({
                          scriptId:'customscript_adv_sl_prntintldocsso',
                          deploymentId:'customdeploy_adv_sl_prntintldocsso',
                          params:{
                              rid:ID,
                          },
                      });

                      form.addButton({
                          label:"Intl Docs",
                          id:"custpage_intldocs",
                          functionName:'window.open("'+URL+'", target=\"_blank\")',
                      });	
                    }
				}
				catch(e){
					log.error("Close Order Button Error", "Unexpected Error:  " + e);
				}
			}
			
		}
		
		//Returns true if any lines are overcommited - BSD-60625 - JLH - 2022/04/04
		 function validateOverCommittedLines(ID) {
			 
			var myRecord = record.load({
				type: 'salesorder',
				   id: ID,
			});
        //log.audit("validateOverCommittedLines - start", myRecord.id);
			var linesGood = false;
			for (var index = 0; index < myRecord.getLineCount({ sublistId: "item" }); index++) {
				if (myRecord.getSublistValue({ sublistId: "item", fieldId: "quantitycommitted", line: index }) > myRecord.getSublistValue({ sublistId: "item", fieldId: "quantity", line: index })) {
					//log.error("Exception Caught - " + myRecord.id, "Overcommitted line blocked from release");
					//myRecord.setValue({ fieldId: 'custbody_adv_order_release_status', value: _HOLD });
					linesGood = true;
					break;
				}
				
			}
			return linesGood;
		}
		
	return {
			beforeLoad : beforeLoad
	}
});