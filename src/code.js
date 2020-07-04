

// First, checks if it isn't implemented yet.
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}


var apList = null;
let selectedSSID = "";
var refreshAPInterval = null; 
var checkStatusInterval = null;

const CONNECTION_STATE = {
	NOT_CONNECTED: "NOT_CONNECTED",
	CONNECTING: "CONNECTING",
	CONNECTED: "CONNECTED",
	FAILED: "FAILED",
}

let connectionState = CONNECTION_STATE.NOT_CONNECTED;


function stopCheckStatusInterval()
{
	if(checkStatusInterval != null)
	{
		clearInterval(checkStatusInterval);
		checkStatusInterval = null;
	}
}

function stopRefreshAPInterval()
{
	if(refreshAPInterval != null)
	{
		clearInterval(refreshAPInterval);
		refreshAPInterval = null;
	}
}

function startCheckStatusInterval()
{
	checkStatusInterval = setInterval(checkStatus, 950);
}

function startRefreshAPInterval()
{
	refreshAPInterval = setInterval(refreshAP, 2800);
}


// The popstate event is fired each time when the current history entry changes.
window.addEventListener('popstate', function(event) 
{
    var url = window.location.hash.substring(1);

   	$('section.section').hide();

	$('#'+url).show();     

}, false);

function connectionDetailsShow()
{
	$("#connect-details").slideDown("fast", function () { });
	$('#button-toggle-network-info').prop('value', "Hide network info");
}

function connectionDetailsHide()
{
	$("#connect-details").slideUp("fast", function () { });
	$('#button-toggle-network-info').prop('value', "Show network info");
}

// Navigation
function change_url(url)
{
	$('section.section').hide();
	$('#'+url).show();
	window.location.hash = url;
}

$(document).ready(function()
{
	// Set initial hash to help back button navigation
	window.location.hash = 'welcome';	

	// Language switcher
	$(".lang_select").change(function() 
	{
	    var lang = $(this).val();

	    $("[lang]").each(function () 
	    {
	        if ($(this).attr("lang") === lang) $(this).fadeIn();
	        else $(this).hide();
	    });
	});
    
	$("#use_http").change(function()
	{
	    if(this.checked) 
	    {
	       $('.conf-settings-http').slideDown();
	       $('.conf-settings-mqtt').slideUp();
	       $('#use_mqtt').prop('checked', false);
	    }
	    else
	    {
	    	$('.conf-settings-http').slideUp();
	    }
	});

	$("#use_mqtt").change(function() 
	{
	    if(this.checked) 
	    {
	       $('.conf-settings-mqtt').slideDown();
	       $('.conf-settings-http').slideUp();
	       $('#use_http').prop('checked', false);
	    }
	    else
	    {
	    	$('.conf-settings-mqtt').slideUp();
	    }
	});

	$('.btn-navi').click(function(e)
	{
		e.preventDefault();
		
		var target_hash = $(this).data('target');

		switch (target_hash)
		{
			case 'back':
				window.history.back(-1);
			break;

			case 'settings-custom':
				var connection_type = $("input[name='connection_type']:checked").val();

				if (connection_type == 'ruuvi') change_url('wifi');
				else change_url('settings-custom');
			break;

			case 'connect':
				var network_type = $("input[name='network_type']:checked").val();

				if (network_type == 'wifi') change_url('wifi-list');
				else change_url('cable-settings');
			break;

			case 'confirm':
				$('.connect-wifi-name').hide();
				$('.connect-cable').show();

				change_url('thankyou');
				save_config();
			break;	

			default: 
				change_url(target_hash);	
		} 

	});


    $("#temp").on("click", function()
    {
        $('section.section').hide();
		$('#wifi-overlay').fadeOut();
    	$('#thankyou').show();

    	save_config();
    });

    $('#wifi-overlay-show-password').click(function(e)
    {
		if ( $('#pwd').prop("type") === "password") 
		{
			$("#pwd").prop("type", "text");
		} 
		else 
		{
			$("#pwd").prop("type", "password");
		}
	});
	
	$('#use-manual-wifi').click(function(e)
	{
		e.preventDefault();
		showWiFiOverlay(null, true);
	});

	$("#wifi-overlay-button-cancel").click(function() {
		selectedSSID = "";
		$('#wifi-overlay').fadeOut();
	});

	$("#wifi-overlay-connecting-button-cancel").click(function() {
		selectedSSID = "";
		$('#wifi-overlay').fadeOut();
		$.ajax({
			url: '/connect.json',
			dataType: 'json',
			method: 'DELETE',
			cache: false,
			data: { 'timestamp': Date.now()}
		});
		startCheckStatusInterval();
		connectionDetailsHide();
		change_url('wifi-list');
	});

	$("#wifi-overlay-button-connect").click(function() {
		let ssid = $('#manual_ssid').val();
		let password = $("#pwd").val();
		performConnect(ssid, password);
	});

	$("#wifi-overlay-connection-successful-button-ok").click(function () {
		$("#wifi-overlay-connection-successful").hide();
		$('#wifi-overlay').fadeOut();
		change_url('wifi-connected');
	})

	$("#wifi-overlay-connection-failed-button-ok").click(function () {
		$("#wifi-overlay-connection-failed").hide();
		$('#wifi-overlay').fadeOut();
	})

	$("#button-toggle-network-info").on("click", function() {
	    if ($("#connect-details").is(":hidden"))
		{
			connectionDetailsShow();
		}
	    else
		{
			connectionDetailsHide();
		}
	});
	
	$("#button-disconnect-wifi").on("click", function() {
		$("#connect-details-wrap").addClass('blur');
		$("#diag-disconnect").slideDown("fast", function () { });
	});
	
	$("#button-disconnect-wifi-no").on("click", function() {
		$("#diag-disconnect").slideUp("fast", function () { });
		$("#connect-details-wrap").removeClass('blur');
	});
	
	$("#button-disconnect-wifi-yes").on("click", function() {
		stopCheckStatusInterval();
		selectedSSID = "";
		
		$( "#diag-disconnect" ).slideUp( "fast", function() {});
		$( "#connect-details-wrap" ).removeClass('blur');
		
		$.ajax({
			url: '/connect.json',
			dataType: 'json',
			method: 'DELETE',
			cache: false,
			data: { 'timestamp': Date.now()}
		});
		startCheckStatusInterval();
		connectionDetailsHide();
		change_url('wifi-list');
	});
	

	//first time the page loads: attempt get the connection status and start the wifi scan
	refreshAP();
	startCheckStatusInterval();
	startRefreshAPInterval();
	
});

function checkSSIDAndPassword()
{
	let ssid = $('#manual_ssid').val();
	let password = $("#pwd").val();
	if (ssid === '' || password.length < 8)
	{
		$('#wifi-overlay-button-connect').attr('disabled', 'disabled');
	}
	else
	{
		$('#wifi-overlay-button-connect').removeAttr('disabled');
	}
}

/**
 * @brief Show WiFi overlay with SSID and password
 * @param ssid - SSID name or null if it must be entered by the user
 * @param isAuthNeeded - true if a password is required
 */
function showWiFiOverlay(ssid, isAuthNeeded)
{
	let inputSSID = $('#manual_ssid');
	let inputPassword = $('#pwd');
	inputSSID.val(ssid);
	inputPassword.val('');
	if (isAuthNeeded)
	{
		$("#wifi-overlay-enter-ssid").show();
		if (ssid)
		{
			$('#wifi-overlay-enter-ssid-title-manual').hide();
			$('#wifi-overlay-enter-ssid-title-auto').show();
		}
		else
		{
			$('#wifi-overlay-enter-ssid-title-manual').show();
			$('#wifi-overlay-enter-ssid-title-auto').hide();
		}

		$('#wifi-overlay-button-connect').attr('disabled', 'disabled');

		inputSSID.keyup(checkSSIDAndPassword);
		inputPassword.keyup(checkSSIDAndPassword);
		inputPassword.focus();
	}
	else
	{
		$("#wifi-overlay-enter-ssid").hide();
	}

	$("#wifi-overlay-connecting").hide();
	$("#wifi-overlay-connection-successful").hide();
	$("#wifi-overlay-connection-failed").hide();

	$('#wifi-overlay').fadeIn();
}

// Check if need for auth screen
function selected_wifi_auth_required(ssid)
{
	let selectedItem = jQuery.grep(apList, function(item)
	{
		return (item.ssid === ssid);
	});
	if (selectedItem.length)
	{
		return (selectedItem[0].auth !== 0);
	}
	return true;
}

// Init function needed as click events are lost everytime list is updated
function initWifiList()
{
	$('.wifi-list a').click(function(e) 
	{
    	e.preventDefault();
		let ssid = $(this).text();
    	let isAuthNeeded = selected_wifi_auth_required(ssid);
		$(".wifi-network-name").text(ssid);
		showWiFiOverlay(ssid, isAuthNeeded);
		if (!isAuthNeeded)
    	{
    		performConnect(ssid, null);
    	}
    });
}

function performConnect(ssid, password)
{
	//stop the status refresh. This prevents a race condition where a status 
	//request would be refreshed with wrong ip info from a previous connection
	//and the request would automatically shows as succesful.
	stopCheckStatusInterval();
	
	//stop refreshing wifi list
	stopRefreshAPInterval();

	selectedSSID = ssid;
	$(".wifi-network-name").text(ssid);

	$('#manual_ssid').onkeyup = null;
	$('#pwd').onkeyup = null;

	$("#wifi-overlay-enter-ssid").hide();
	$("#wifi-overlay-connecting").show();

	$.ajax({
			url: '/connect.json',
			dataType: 'json',
			method: 'POST',
			cache: false,
			headers: {'X-Custom-ssid': ssid, 'X-Custom-pwd': password},
			data: {'timestamp': Date.now()},
			success: function (data, text) {
				connectionState = CONNECTION_STATE.CONNECTING;
			},
		error: function (request, status, error) {
				alert('HTTP error: ' + status + '\n' + 'Status: ' + request.status + '(' + request.statusText + ')\n' + request.responseText);
			}
		}
	);

	//now we can re-set the intervals regardless of result
	startCheckStatusInterval();
	startRefreshAPInterval();
}



function rssiToIcon(rssi)
{
	if(rssi >= -60){
		return 'w0';
	}
	else if(rssi >= -67){
		return 'w1';
	}
	else if(rssi >= -75){
		return 'w2';
	}
	else{
		return 'w3';
	}
}


// Load wifi list
function refreshAP()
{
	$.getJSON( "ap.json", function( data ) 
	{
		if(data.length > 0)
		{
			//sort by signal strength
			data.sort(function (a, b) 
			{
				var x = a["rssi"]; var y = b["rssi"];
				return ((x < y) ? 1 : ((x > y) ? -1 : 0));
			});

			apList = data;

			refreshAPHTML(apList);
		}
	});
}

// Refresh wifi selection list
function refreshAPHTML(data)
{
	var h = "";
	data.forEach(function(e, idx, array) 
	{
		//h += '<div class="ape{0}"><div class="{1}"><div class="{2}">{3}</div></div></div>'.format(idx === array.length - 1?'':' brdb', rssiToIcon(e.rssi), e.auth==0?'':'pw',e.ssid);
		h += '<li><a href="" class="{0}">{3}<span class="{2}"></span></a></li>'.format(idx === array.length - 1?'':' brdb', rssiToIcon(e.rssi), e.auth==0?'':'pw',e.ssid);
		h += "\n";
	});
	
	$( "#ssid-list" ).html(h);

	initWifiList();
}


function checkStatus()
{
	$.getJSON( "/status.json", function( data ) 
	{
		if(data.hasOwnProperty('ssid') && data['ssid'] !== "")
		{
			if(data["ssid"] === selectedSSID)
			{
				//that's a connection attempt
				if(data["urc"] === 0)
				{
					$("#ip").text(data["ip"]);
					$("#netmask").text(data["netmask"]);
					$("#gw").text(data["gw"]);

					switch (connectionState) {
						case CONNECTION_STATE.NOT_CONNECTED:
							break;
						case CONNECTION_STATE.CONNECTING:
							$("#wifi-overlay-connecting").hide();
							$("#wifi-overlay-connection-successful").show();
							$("#wifi-overlay-connection-failed").hide();
							break;
						case CONNECTION_STATE.CONNECTED:
							break;
						case CONNECTION_STATE.FAILED:
							break;
					}
					connectionState = CONNECTION_STATE.CONNECTED
				}
				else if(data["urc"] === 1)
				{
					//failed attempt
					$("#connect-details h1").text('');
					$("#ip").text('0.0.0.0');
					$("#netmask").text('0.0.0.0');
					$("#gw").text('0.0.0.0');
					
					switch (connectionState) {
						case CONNECTION_STATE.NOT_CONNECTED:
							break;
						case CONNECTION_STATE.CONNECTING:
							$("#wifi-overlay-connecting").hide();
							$("#wifi-overlay-connection-successful").hide();
							$("#wifi-overlay-connection-failed").show();
							break;
						case CONNECTION_STATE.CONNECTED:
							break;
						case CONNECTION_STATE.FAILED:
							break;
					}
					connectionState = CONNECTION_STATE.FAILED
				}
			}
			else if(data.hasOwnProperty('urc') && data['urc'] === 0)
			{
				//ESP32 is already connected to a wifi without having the user do anything
				switch (connectionState) {
					case CONNECTION_STATE.NOT_CONNECTED:
						$(".wifi-network-name").text(data["ssid"]);
						$("#ip").text(data["ip"]);
						$("#netmask").text(data["netmask"]);
						$("#gw").text(data["gw"]);
						change_url('wifi-connected');
						connectionDetailsShow();
						connectionState = CONNECTION_STATE.CONNECTED;
						break;
					case CONNECTION_STATE.CONNECTING:
						break;
					case CONNECTION_STATE.CONNECTED:
						break;
					case CONNECTION_STATE.FAILED:
						break;
				}
			}
		}
		else if(data.hasOwnProperty('urc') && data['urc'] === 2)
		{
			//that's a manual disconnect
            // TODO: implement
			// if($("#wifi-status").is(":visible"))
			// {
			// 	$("#wifi-status").slideUp( "fast", function() {});
			// }
		}
	})
	.fail(function() 
	{
		//don't do anything, the server might be down while esp32 recalibrates radio
	});


}
