var LetterWriter = (function(){
    // create the LetterWriter object
    var lw = {};

    // globals
    var defaultStart = "start";
    lw.defaultStart = function() { return defaultStart }
    var anonymousNonterminalPrefix = "choice";
    var newParamPrefix = "Attribute";
    lw.defaultNever = "0";
    lw.defaultAlways = "100";

    var nontermAnchorPrefix = "choice_"

    // generic functions
    function chain(f,g) { return function() { f.apply(this); g.apply(this) } }  // chain two notify functions

    function sanitizeId(id) {
	id = id.replace(/\s/g,'_')
	id = id.replace(/[^a-zA-Z0-9_]/g,'')
	if (/^[0-9]/.test(id)) id = '_' + id
	return id
    }

    function setUnion(array1,array2) {
	var h = {};
	function f(x) { h[x] = 1 }
	array1.map(f);
	array2.map(f);
	return Object.keys(h)
    }

    function indexOf(haystack,needle) {
        for(var i = 0; i < haystack.length; i++) {
	    if(haystack[i] === needle) {
                return i;
	    }
        }
        return -1;
    };

    function extend (destination, source, doNotOverwrite) {  // source overwrites destination
	if (typeof(source) != "undefined") {
	    for (var property in source) {
		if (source.hasOwnProperty(property))
		    if (!doNotOverwrite || !destination.hasOwnProperty(property))
			destination[property] = source[property];
	    }
	}
	return destination;
    }
    lw.extend = extend;

    function buildErrorMessage(e) {
	return e.line !== undefined && e.column !== undefined
	    ? "Line " + e.line + ", column " + e.column + ": " + e.message
	    : e.message;
    }

    function logError(str,div) {
	console.log (str);
	if (typeof(div) != 'undefined')
	    div.innerHTML = "Error loading LetterWriter template file: <p><code>" + str + "</code> <p>Check the debugger console for more details.<br><br><a href=\"#\" onclick=\"nav.resetEverything();location.reload()\">Click here</a> to reset local storage and reload page.";
    }

    function hideElement(e) { e.setAttribute ("style", "display: none"); };
    function showElement(e) { e.setAttribute ("style", "display: inline"); };

    function addClassToElement(elt,newClass) {
	if ('className' in elt)
	    elt.className += ' ' + newClass
	else
	    elt.className = newClass
    }

    function removeClassFromElement(elt,theClass) {
	if ('className' in elt) {
	    var re = new RegExp('\\b'+theClass+'\\b')
	    elt.className = elt.className.replace(re,'','g')
	}
    }

    function iterateDom(node,pre,post) {
	pre.apply(node)
	if (node.hasChildNodes()) {
	    var child = node.firstChild;
	    while (child) {
		if (child.nodeType === 1) {
		    iterateDom(child,pre,post);
		}
		child = child.nextSibling;
	    }
	}
	if (typeof post == 'function')
	    post.apply(node)
    }


    // LetterWriter.Navigator
    lw.Navigator = function(defaultSource) {
	var nav = this;

	var grammar, letter, editor, template, storageKey;
	storageKey = "LetterWriter"
	template = document.getElementById("editorTemplate")
//	var editorArgs = {tooltips:false}
	var editorArgs = {}  // TODO: get tooltips flag from localStorage

	nav.grammar = function() { return grammar }
	nav.letter = function() { return letter }
	nav.editor = function() { return editor }

	$("#initialExample").attr("href",defaultSource)

	function loadFile(evt) {
	    if (window.File && window.FileReader && window.FileList && window.Blob) {
	    } else {
		alert('The File APIs are not fully supported in this browser.');
	    }

	    var files = evt.target.files
	    var file = files[0]  // assume just one file
	    
	    var reader = new FileReader();
	    reader.onload = (function(e) {
		var text = e.target.result;
		nav.loadInitialGrammar(text);
	    })
	    reader.readAsText(file);
	}
	$("#editorTemplateLoadFile").change (loadFile)

	function showIDEChecked() { return $("#showIDECheckbox")[0].checked }
	nav.changeShowIDE = function() {
	    if (showIDEChecked()) {
		$("#editor,#editorMapContainer,#editorParseTreeContainer,#editorDivider,.letterDebuggerShortcuts").show()
		$("#letterWriterBackground").toggleClass("letterWriterBackgroundEditMode").toggleClass("letterWriterBackgroundPlayMode")
		$("#gameContainer").attr("style","border-style:solid")
		$("#scoreContainer").attr("style","position:static;width:auto;bottom:auto")
		nav.showDebugParseTree()
		nav.showDebugMap()
	    } else {
		$("#editor,#editorMapContainer,#editorParseTreeContainer,#editorDivider,.letterDebuggerShortcuts").hide()
		$("#letterWriterBackground").toggleClass("letterWriterBackgroundEditMode").toggleClass("letterWriterBackgroundPlayMode")
		$("#gameContainer").attr("style","border-style:none;left:20%")
		$("#scoreContainer").attr("style","")
	    }
	}

	nav.changeShowTooltips = function() {
	    if ($("#showTooltipsCheckbox")[0].checked) {
		editorArgs.tooltips = true
	    } else {
		editorArgs.tooltips = false
	    }
	    nav.createEditor()
	}

	function hideIDE() {
	    if (showIDEChecked()) {
		$("#showIDECheckbox")[0].checked = false
		nav.changeShowIDE()
	    }
	}

	nav.removeEditor = function() {
	    if (editor) editor.remove()
	    editor = null
	}

	nav.removeLetter = function() {
	    $("#restartWarning").empty()
	    if (letter) letter.clear()
	    letter = null
	}

	nav.saveTemplateInStorage = function(){
	    localStorage.setItem (storageKey, template.value)
	    nav.initSaveLink()
	}

	nav.initSaveLink = function(){
	    $("#templateSaveLink").attr("href","data:text/plain;charset=utf-8," + encodeURIComponent(template.value)).attr("download","template.txt")
	}

	nav.createEditor = function() {
	    nav.removeEditor()
	    editor = grammar.newEditor(editorArgs)
	    editor.warnChange ($("#restartWarning"), "The underlying template has been edited. Restart the letter to stay in sync.")
	    // the following line is disabled, meaning that click-navigation from parse tree to editor
	    // will still be attempted, even if parse tree has gotten out of sync with editor
	    // This may cause errors which are not currently caught...
	    //    editor.addNotify (function() { letter.detachEditor() })
	    editor.addNotify (nav.saveTemplateInStorage)
	    editor.addNotify (nav.recordEdit)
	}

	nav.rebuildGrammarFromText = function() {
	    try {
		grammar = new LetterWriter.Grammar(template.value).normalize()
		nav.createEditor()
		nav.restartLetterFromGrammar()
		// do a bit of notifying (calling the editor's main notify function would update this textarea, not what we want)
		editor.warnChangeFunction()
		nav.saveTemplateInStorage()
		$("#editorTemplate").focus()
	    } catch (e) {
		$("#editorTemplateFailedLoad").append("<i>Failed to initialize:</i><br><code><verbatim>" + template.value + "</verbatim></code><br><span class=\"undefinedParameter\">" + e.message + "</span></font>")
		console.log(e.message);
	    }
	}

	nav.templateEdited = function() {
	    nav.rebuildGrammarFromText()
	    nav.recordEdit()

	    redoHistory = []
	    $("#redoEdit").removeAttr("href")  // disable redo link
	}

	nav.restartLetterFromGrammar = function(args) {
	    nav.removeLetter()
	    letter = grammar.clone().newLetter(args)
	    letter.setTitle()
	    letter.attachEditor(editor)
	}

	nav.rebuildGrammarAndLetterFromText = function() {
	    nav.rebuildGrammarFromText()
	    nav.restartLetterFromGrammar()
	}

	nav.setupTemplateSyntax = function() {
	    var xhr = new XMLHttpRequest();
	    xhr.open ("GET", "doc/TemplateSyntax.html", false);
	    xhr.send();
	    $("#TemplateSyntax").append(xhr.responseText)

	    function showSyntax(e) { e && e.preventDefault(); $("#TemplateSyntax").show(); $("#SyntaxToggle").click(hideSyntax) }
	    function hideSyntax(e) { e && e.preventDefault(); $("#TemplateSyntax").hide(); $("#SyntaxToggle").click(showSyntax) }
	    hideSyntax()
	}

	nav.loadInitialGrammar = function(grammarText,letterArgs) {

	    var storedText = localStorage.getItem(storageKey)

	    try {
		grammar = grammarText
		    ? new LetterWriter.Grammar(grammarText)
		    : ((storedText && storedText.length > 0 && /\S/.test(storedText))
		       ? new LetterWriter.Grammar(storedText)
		       : LetterWriter.Grammar.newFromUrl(defaultSource))
	    } catch (e) {
		$("#editorTemplateFailedLoad").append("<i>Failed to initialize:</i><br><code><verbatim>" + storedText + "</verbatim></code><br><span class=\"undefinedParameter\">" + e.message + "</span></font>")
		console.log(e.message);
		grammar = LetterWriter.Grammar.newFromUrl(defaultSource)
	    }
	    grammar = grammar.normalize()
	    nav.createEditor()

	    $("#editorTemplate").change(null)
	    template.value = grammar.toCanonicalString()
	    $("#editorTemplate").change(nav.templateEdited)
	    nav.initSaveLink()
	    nav.initEditHistory()

	    nav.restartLetterFromGrammar(letterArgs)
	}

	nav.resetEverything = function() {
	    if (confirm ("Really, delete everything?")) {
		localStorage.removeItem(storageKey)
		nav.removeEditor()
		nav.removeLetter()
		nav.loadInitialGrammar()
	    }
	}


	var undoHistory, redoHistory;
	var maxUndos = 10;

	nav.recordEdit = function() {
	    var str = editor.grammar.toCanonicalString()
	    if (undoHistory.length == 0 || str != undoHistory[undoHistory.length - 1]) {
		undoHistory.push (str)
		if (undoHistory.length >= maxUndos)
		    undoHistory.shift()
		if (undoHistory.length > 1)
		    $("#undoEdit").attr("href","#")  // enable undo link
	    }
	}

	nav.initEditHistory = function() {
	    undoHistory = [template.value]
	    redoHistory = []
	    $("#undoEdit").removeAttr("href")  // disable undo link
	    $("#redoEdit").removeAttr("href")  // disable redo link
	}

	nav.undoEdit = function(e) {
	    e.preventDefault()
	    var str = grammar.toCanonicalString()
	    var oldStr = str;
	    while (undoHistory.length > 0 && str == oldStr) {
		var oldStr = undoHistory.pop()
	    }
	    if (undoHistory.length == 0)
		$("#undoEdit").removeAttr("href")  // disable undo link
	    if (oldStr != str) {
		redoHistory.push(str)
		template.value = oldStr
		nav.rebuildGrammarFromText()
		nav.recordEdit()
		$("#redoEdit").attr("href","#")  // enable redo link
	    }
	}
	$("#undoEdit").click(undoEdit)

	nav.redoEdit = function(e) {
	    e.preventDefault()
	    if (redoHistory.length > 0) {
		template.value = redoHistory.pop()
		nav.rebuildGrammarFromText()
		if (redoHistory.length == 0)
		    $("#redoEdit").removeAttr("href")  // disable redo link
		nav.recordEdit()
	    }
	}
	$("#redoEdit").click(redoEdit)

	// debugger
	nav.showDebugParseTree = function() { letter.showDebugParseTree() }
	nav.showDebugMap = function() { editor.showDebugMap() }
	

	// multiplayer
	function playerID() { $("#playerName");
 return $("#playerName")[0].value }
	function setPlayerID(n) { $("#playerName")[0].value = n }
	function playerFingerprint() { var id = playerID(); id.replace(/[^A-Za-z0-9]/g,"_"); return id }
	function playerBlob() { return { id: playerID(), fingerprint: playerFingerprint() } }

	// pub/sub message object
	nav.Message = function(message) { $.extend(true,this,message) }  // use jquery extend for deep copy
	nav.Message.prototype.clone = function() { return new nav.Message(this) }
	nav.Message.prototype.gramHash8 = function() {
	    return this.grammar.hash.substring(0,8).replace(/[^A-Za-z0-9]/g,"_")
	}
	nav.Message.prototype.hashChan = function(prefix) { return '/' + prefix + '/' + this.gramHash8() + '/' + this.channel }
	nav.Message.prototype.hashChanPlayer = function(prefix,playerFingerprints) { return this.hashChan(prefix) + this.playerFingerprints().map(function(s){return'/'+s}).join('') }
	nav.Message.prototype.requestPublishChannel = function() { return this.hashChan('request') }
	nav.Message.prototype.grammarSubscribeChannel = function() { return '/grammar/' + this.gramHash8() + '/**' }
	nav.Message.prototype.grammarPublishChannel = function() { return this.hashChan('grammar') }
	nav.Message.prototype.playerIDs = function() { return this.player.map(function(p){return p.id}) }
	nav.Message.prototype.playerFingerprints = function() { return this.player.map(function(p){return p.fingerprint}) }
	nav.Message.prototype.inviteChannel = function() { return this.hashChanPlayer('invite') }
	nav.Message.prototype.allInviteChannels = function() { return this.inviteChannel() + '/**' }
	nav.Message.prototype.applyChannel = function() { return this.hashChanPlayer('apply') }
	nav.Message.prototype.quitSubscribeChannel = function() { return this.hashChan('quit') + '/**' }
	nav.Message.prototype.quitPublishChannel = function(role) { return this.hashChan('quit') + '/~' + role + '/' + playerFingerprint() }
	nav.Message.prototype.playChannelPrefix = function() { return this.hashChanPlayer('play') }
	nav.Message.prototype.playersJoined = function() { return this.player.length }
	nav.Message.prototype.playersNeeded = function() { return this.grammar.roles - this.player.length }
	nav.Message.prototype.gotAllPlayers = function() { return this.playersNeeded() == 0 }
	nav.Message.prototype.populatePlayerList = function() {
	    $("#pendingGrammarName").text(this.grammar.title)
	    var n = this.playersNeeded(), j = this.playersJoined()
	    $("#pendingGrammarText").text('Waiting on channel #' + this.channel + ": got " + plural(j,"player") + (n>0 ? (", need " + n) : ", loading game"))
	    $("#playerList").empty()
	    for (var i = 0; i < j; ++i) { $("#playerList").append($('<li/>').text(this.player[i].id)) }
	}

	function clearPlayerList() {
	    $("#pendingGrammarName").text('(starting game)')
	    $("#pendingGrammarText").text('')
	    $("#playerList").empty()
	}

	// pub/sub
	var client = new Faye.Client('/faye');

	var clientLogger = {
	    incoming: function(message, callback) {
		console.log('incoming', message);
		callback(message);
	    },
	    outgoing: function(message, callback) {
		console.log('outgoing', message);
		callback(message);
	    }
	};
	client.addExtension(clientLogger);

	var publisher = {}
	var listener = {}, moveListener = {}
	function cancelListenerWithKey(type,l) { if (type in l) { l[type].cancel(); delete l[type] } }
	function cancelListener(type) { cancelListenerWithKey(type,listener) }
	function cancelMoveListener(type) { cancelListenerWithKey(type,moveListener) }
	function cancelPublisher(type) { if (type in publisher) { clearInterval(publisher[type]); delete publisher[type] } }
	function deactivateAll() {
	    for (var type in publisher) { cancelPublisher(type) }
	    function cancelAll(l) { for (var type in l) cancelListenerWithKey(type,l) }
	    cancelAll(listener)
	    cancelAll(moveListener)
	}

	function addMoveListener(type,channel,callback) {
	    return moveListener[type] = client.subscribe(channel,callback)
	}

	var invitationDelay = 1000
	function invitationPublisher(msg) { return function() { client.publish(msg.inviteChannel(), msg) } }
	function activateInvitationPublisher(msg) {
	    var publishInvitation = invitationPublisher(msg)
	    publisher['invitation'] = window.setInterval (publishInvitation, invitationDelay)
	    publishInvitation()
	}
	function cancelInvitationPublisher() { cancelPublisher('invitation') }

	function activateApplicationListener(msg) {
	    function applicationListener(m) {
		
		var message = new nav.Message(m)
		cancelInvitationPublisher()
		cancelApplicationListener()
		message.populatePlayerList()
		if (message.gotAllPlayers()) {
		    invitationPublisher(message) ()  // publish complete player list: signals that invitation is canceled (HACK: really need a separate 'uninvite' channel, to be called when quitting from "Start game")
		    nav.restartLetterFromGrammar ({ letterProperties: { gameMessage: message,
									playerRole: 0,
									playerIDs: message.playerIDs(),
									client: client,
									addMoveListener: addMoveListener,
									cancelMoveListener: cancelMoveListener} })
		    startMultiplayerGame()
		} else {
		    listener['application'] = client.subscribe (message.applyChannel(), applicationListener)
		    activateInvitationPublisher(message)
		}
	    }
	    applicationListener(msg)
	}
	function cancelApplicationListener() { cancelListener('application') }

	function activateRequestListener(msg) {
	    var gc = msg.grammarPublishChannel()
	    listener['request'] = client.subscribe (msg.hashChan('request'),
						    function(msg) {
							client.publish(gc, { channel: msg.channel,
									     grammar: { title: grammar.title,
											roles: grammar.roles,
											hash: grammar.md5hash(),
											text: grammar.toCanonicalString() } } ) })
	}


	function quitMultiplayerFunction(msg,role) {
	    var c = msg.channel, g = msg.grammar, qc = msg.quitPublishChannel(role)
	    return function() {
		deactivateAll()
		client.publish(qc, { channel: c,
				     grammar: g,
				     quit: { role: role } }) }
	}

	function activateQuitListener(msg) {
	    listener['quit'] = client.subscribe (msg.quitSubscribeChannel(), quitMultiplayerAndHideMenu)
	}

	function showMultiplayerMenu() { 
	    hideIDE()
	    $("#letter,#slidersContainerParent,#scoreContainerParent,#topLinksContainer,#showIDECheckboxContainer").hide()
	    $("#multiplayerMenu").show()
	    if (grammar.isSinglePlayer())
		$("#startGameItem,#playerNameContainer").hide()
	    else
		$("#startGameItem,#playerNameContainer").show()

	    $("#joinGameItem,#pendingMultiplayer").hide()
	    $("#menuLink").text("menu")

	    if (playerID().length == 0) {
		var names = ['Abbie', 'Charlie', 'Dominique', 'Elephant', 'Fred', 'Ghola', 'Harm', 'Illest', 'Jo', 'Kewl', 'Lou', 'Mika', 'Nom', 'Orinoco', 'Pat', 'Quebec', 'Ros', 'Stef', 'Tor', 'Uzbek', 'Venezia', 'Willow', 'Xero', 'Yam', 'Zoom']
		setPlayerID(names[Math.floor(Math.random() * names.length)])
	    }

	    activateInvitationListener()
	}

	function hideMultiplayerMenu() { 
	    deactivateAll()
	    $("#letter,#slidersContainerParent,#scoreContainerParent,#topLinksContainer,#restart,#showIDECheckboxContainer").show()
	    $("#multiplayerMenu,#pendingMultiplayer").hide()
	    $("#menuLink").text("menu").click(showMultiplayerMenu)
	}

	function startMultiplayerGame() { 
	    $("#letter,#slidersContainerParent,#scoreContainerParent,#topLinksContainer").show()
	    $("#multiplayerMenu,#pendingMultiplayer,#restart,#showIDECheckboxContainer").hide()
	    $("#menuLink").text("quit").click(quitMultiplayerAndHideMenu)
	}

	nav.showMultiplayerMenu = showMultiplayerMenu
	nav.hideMultiplayerMenu = hideMultiplayerMenu

	function activateInvitationListener() {
	    $("#gameList").empty()
	    listener['invitation'] = client.subscribe('/invite/**', function(m) {
		// handle message
		var message = new nav.Message(m)
		var desc = "<b>" + message.grammar.title + "</b> <small><i>(" + message.gramHash8() + ' / ' + message.channel + ")</i></small> Players: <i><b>" + message.playerIDs().join(', ') + '</b></i>'
		var id = "game-" + message.gramHash8() + "-" + message.channel
		var elt = $("#gameList").find("#"+id)
		if (message.gotAllPlayers())
		    elt.remove()
		else {
		    if (!elt.length) {
			elt = $('<li/>').attr('id',id)
			$("#gameList").append(elt)
			$("#joinGameItem,#playerNameContainer").show()
		    }
		    var link = $('<a/>').attr("href","#").addClass("joinGameLink").html(desc)
		    link.click(function(e){ nav.joinGame(message) })
		    elt.empty().append(link)
		}
	    })
	}
	function cancelInvitationListener() { cancelListener('invitation') }

	function activateGrammarListener(msg,role) {
	    cancelGrammarListener()
	    function grammarHandler(m) {
		cancelGrammarListener()
		nav.loadInitialGrammar (m.grammar.text,
					{ letterProperties: { gameMessage: msg,
							      playerRole: role - 1,
							      playerIDs: msg.playerIDs(),
							      client: client,
							      addMoveListener: addMoveListener,
							      cancelMoveListener: cancelMoveListener } })
		startMultiplayerGame()
	    }
	    listener['grammar'] = client.subscribe (msg.grammarSubscribeChannel(), grammarHandler)
	    client.publish (msg.requestPublishChannel(), msg)
	}
	function cancelGrammarListener() { cancelListener('grammar') }

	function activateGameListener(msg,role) {
	    cancelGameListener()
	    function gameListener(m) {
		var newMsg = new nav.Message(m)
		cancelConflictListener()
		cancelGameListener()
		newMsg.populatePlayerList()
		if (newMsg.gotAllPlayers()) {
		    activateQuitListener(newMsg)
		    activateGrammarListener(newMsg,role)
		} else
		    activateGameListener(newMsg,role)
	    }
	    listener['game'] = client.subscribe (msg.inviteChannel(), gameListener)
	    listener['game*'] = client.subscribe (msg.allInviteChannels(), gameListener)
	}
	function cancelGameListener() { cancelListener('game'); cancelListener('game*') }

	function activateConflictListener(msg,expectedMsg) {
	    cancelConflictListener()
	    listener['conflict'] = client.subscribe (msg.allInviteChannels(),
						     function(newMsg) {
							 var n = msg.player.length
							 if (newMsg.player[n].id != expectedMsg.player[n].id) {
							     deactivateAll()
							     showMultiplayerMenu()
							 }
						     })
	}
	function cancelConflictListener() { cancelListener('conflict') }

	nav.joinGame = function(msg) {
	    nav.removeEditor()  // don't want player editing grammar during game
	    cancelInvitationListener()
	    $("#multiplayerMenu").hide()
	    $("#pendingMultiplayer").show()
	    msg.populatePlayerList()
	    var newMsg = new nav.Message(msg)
	    newMsg.player.push (playerBlob())
	    var role = newMsg.playersJoined()
	    client.publish (msg.applyChannel(), newMsg)
	    activateConflictListener(msg,newMsg)
	    activateGameListener(newMsg,role)
	    quitMultiplayer = chain (quitMultiplayer, quitMultiplayerFunction(msg,role))
	}

	var quitMultiplayer = function() { }
	function quitMultiplayerAndHideMenu() {
	    quitMultiplayer()
	    quitMultiplayer = function() { }  // reset quitMultiplayer chain of functions
	    hideMultiplayerMenu()
	    nav.restartLetterFromGrammar()
	}
	nav.quitMultiplayer = quitMultiplayerAndHideMenu

	nav.startGame = function(e) {
	    nav.removeEditor()  // don't want player editing grammar during game
	    cancelInvitationListener()
	    $("#multiplayerMenu").hide()
	    $("#pendingMultiplayer").show()
	    clearPlayerList()
	    $.get("id",function(channelID) {
		var msg = new nav.Message ({ channel: channelID,
					     grammar: { title: grammar.title,
							roles: grammar.roles,
							hash: grammar.md5hash() },
					     player: [ playerBlob() ] })
		quitMultiplayer = chain (quitMultiplayer, quitMultiplayerFunction(msg,1))
		msg.populatePlayerList()
		activateApplicationListener(msg)  // also calls activateInvitationPublisher(msg)
		activateRequestListener(msg)
		activateQuitListener(msg)
	    })
	}

	$(function(){
	    nav.setupTemplateSyntax()
	    nav.loadInitialGrammar()
	    nav.changeShowIDE()
	});
    }

    // LetterWriter.Grammar
    // this.nonterm = Object mapping nonterminal IDs (without the leading "@") to LetterWriter.Nonterminal objects
    // this.nonterms = Array of LetterWriter.Nonterminal objects, in the order they're declared in the Grammar
    // this.start = LetterWriter.Nonterminal object deemed to be the start
    lw.Grammar = function(letterTemplate) {
	try {
	    var parseResult = lw.parser.parse (letterTemplate);
	    extend (this, parseResult);
	} catch (e) {
	    logError (buildErrorMessage(e), document.getElementById("letter") || document.body);
	    throw e;
	}

	var anonCount = 0;
	var grammar = this;
	this.createAnonId = function(prefix,suffix) {
	    var newId;
	    do { newId = (prefix || anonymousNonterminalPrefix) + (++anonCount) + (suffix || "") }
	    while (newId in grammar.nonterm)
	    return newId;
	}
    }

    lw.Grammar.newFromUrl = function(url) {
	console.log ("Loading LetterWriter grammar from \"" + url + "\"");
	try {
	var xhr = new XMLHttpRequest();
	    xhr.open ("GET", url, false);
	    xhr.send();
	    var template = xhr.responseText;
	} catch (e) {
	    logError (buildErrorMessage(e), document.getElementById("letter") || document.body);
	    throw e;
	}
	return new LetterWriter.Grammar (template);
    }

    lw.Grammar.prototype.newLetter = function(args) {
	return new lw.Letter (this, args);
    }

    lw.Grammar.prototype.findParam = function(paramId) {
	for (var i = 0; i < this.params.length; ++i)
	    if (this.params[i].id.toLowerCase() == paramId.toLowerCase())
		return this.params[i];
	return undefined;
    }

    lw.Grammar.prototype.usesParam = function(paramId) {
	for (var id in this.nonterm)
	    if (this.nonterm[id].hasParam(paramId))
		return true;
	return false;
    }

    lw.Grammar.prototype.createNewParamId = function() {
	var i, id;
	for (i = 1; this.usesParam(id=newParamPrefix+i) || typeof(this.findParam(id)) != "undefined"; ++i) { }
	return id;
    }

    lw.Grammar.prototype.hasScoreParam = function() {
	return ('scoreParam' in this) && typeof(this.scoreParam) != 'undefined'
    }

    // method to return canonical serialization of a Grammar
    // if normalize==true, then all anonymous nonterminal expressions will be assigned explicit names
    // NB: for any grammar g, the function toCanonicalString(true) should be a fixed point, i.e.
    //    g.toCanonicalString(true) == g.toCanonicalString(true).toCanonicalString(true)
    //                              == g.normalize().toCanonicalString()
    // and thus
    // g.normalize().isNormalized() == g.hasNormal()
    //                              == true
    lw.Grammar.prototype.toCanonicalString = function(normalize) {
	var grammar = this;
	var newId = {};
	if (normalize) {
	    for (var i = 0; i < this.nonterms.length; ++i)
		if (this.nonterms[i].anonymous) {
		    newId[this.nonterms[i].id] = this.createAnonId()
		}
	    if (grammar.start.id != defaultStart) {
		if (defaultStart in grammar.nonterm) {  // hmm, I think this should never happen (a nonterm called @start that isn't the start), but just in case
		    newId[defaultStart] = this.createAnonId()
		    console.log ("wow Player, you have been manipulating the Grammar with your Bare Hands?")
		}
		newId[grammar.start.id] = defaultStart
	    }
	}
	return grammar.toStringRenamed (newId, normalize);
    }

    function makePreamblePlaceholderPrompt(props) {
	var str = "";
	var gotPreamble = props.hasOwnProperty("preamble");
	var gotPlaceholder = props.hasOwnProperty("placeholder");
	var gotPrompt = props.hasOwnProperty("prompt");
	if (gotPreamble || gotPlaceholder || gotPrompt) {
	    str += "["
		+ (gotPreamble
		   ? (props.preamble
		      + "|" + (gotPlaceholder ? props.placeholder : "")
		      + "|" + (gotPrompt ? props.prompt: ""))
		   : ((gotPlaceholder
		       ? (props.placeholder + "|")
		       : "") + (gotPrompt ? props.prompt: "")))
		+ "]"
	}
	return str;
    }

    function makeMaxUsage(obj) {
	var str = ""
	if ("maxUsage" in obj) {
	    var max = obj.maxUsage;
	    if (max == 1) str = "[once] "
	    else if (max == 2) str = "[twice] "
	    else if (max == 3) str = "[thrice] "
	    else str = "[use " + obj.maxUsage + "] ";
	}
	return str;
    }

    function makeTimesHidden(obj) {
	var str = ""
	if ("timesHidden" in obj) {
	    var n = obj.timesHidden;
	    if (n == 1) str = "[hide once] "
	    else if (n == 2) str = "[hide twice] "
	    else if (n == 3) str = "[hide thrice] "
	    else str = "[hide " + n + "] ";
	}
	return str;
    }

    lw.Grammar.prototype.toStringRenamed = function(newId,normalize) {

	function makeNontermRef(props,id) {
	    return makePreamblePlaceholderPrompt(props)
		+ "@" + ((id in newId) ? newId[id] : id)
		+ ((("pause" in props) && props.pause) ? ";" : "")
		+ ((("commit" in props) && props.commit) ? "!" : "")
		+ ((("random" in props) && props.random) ? "?" : "");
	}

	function makeRhsExpr(props,rules) {
	    var str = makePreamblePlaceholderPrompt (props);
	    str += "{";
	    for (var j = 0; j < rules.length; ++j) {
		var rule = rules[j];
		if (j > 0) str += "|";
		if (rule.hint.length || "maxUsage" in rule || "timesHidden" in rule)
		    str += rule.hint + makeMaxUsage(rule) + makeTimesHidden(rule) + "=>";
		str += rule.rhs.map(function(sym){
		    if (sym instanceof LetterWriter.NontermReference) {
			var nonterm = sym.nonterminal;
			if (nonterm.anonymous) {
			    if (normalize)
				return makeNontermRef (sym.props, nonterm.id);  // anonymous id remapping will have been set up as part of normalization
			    return makeRhsExpr (sym.props, nonterm.rules);
			}
			return makeNontermRef (sym.props, nonterm.id);
		    } else
			return sym.asText();
		}).join("");
	    }
	    str += "}";
	    return str;
	}

	var str = "";
	str += "title {" + this.title + "}\n"
	str += "roles " + this.roles + "\n"

	if (typeof(this.scoreParam) != 'undefined')
	    str += "score " + this.scoreParamType + this.scoreParam + "\n"

	if ("wait" in this.undo)
	    str += "undo { wait: " + this.undo.wait + " }\n"

	if (this.params.length)
	    str += "control " + this.params.map(function(p){return p.asText()}).join(", ") + "\n";
	for (var i = 0; i < this.nonterms.length; ++i) {
	    var nonterm = this.nonterms[i];
	    if ((normalize || !nonterm.anonymous) && nonterm.rules.length) {
		var id = nonterm.id in newId ? newId[nonterm.id] : nonterm.id;
		if (nonterm.role != lw.Nonterm.prototype.role) str += "#" + nonterm.role + " ";
		if (nonterm.random) str += "random ";
		if (nonterm.pause) str += "pause ";
		if (nonterm.commit) str += "commit ";
		str += "@" + id + makeMaxUsage(nonterm) + " => "
		    + makeRhsExpr (nonterm, nonterm.rules) + "\n";
	    }
	}

	return str;
    }

    // method to clone a Grammar
    lw.Grammar.prototype.clone = function() {
	return new lw.Grammar (this.toCanonicalString (false));
    }

    // method to normalize a Grammar, i.e. remove all anonymous nonterminals
    lw.Grammar.prototype.normalize = function() {
	return new lw.Grammar (this.toCanonicalString (true));
    }

    // method to test if a Grammar is normalized
    lw.Grammar.prototype.isNormalized = function() {
	return this.normalize().toCanonicalString(true) == this.toCanonicalString(true);
    }

    // method to test if a Grammar *can* be normalized,
    // to something that is then invariant under normalization/serialization
    // this is a basic test... its meaning is a bit abstract hence the fun name
    lw.Grammar.prototype.feelsNormal = function() {
	return this.normalize().isNormalized();
    }

    // multiplayer methods
    lw.Grammar.prototype.isSinglePlayer = function() {
	return this.roles == 1;
    }

    lw.Grammar.prototype.md5hash = function() {
	return openpgp_encoding_base64_encode (MD5 (this.toCanonicalString()))
    }

    // editor methods
    lw.Grammar.prototype.newEditor = function(args) {
	return new lw.GrammarEditor (this, args);
    }

    // NontermEditor
    var nteDummyCount = 0;
    lw.NontermEditor = function(grammarEditor,nonterm,parentDiv,olderSiblingDiv) {
	var nontermEditor = this;
	var grammar = grammarEditor.grammar;
	var notify = grammarEditor.notifyChange;

	if (typeof nonterm == 'undefined')
	    nonterm = grammar.start;
	var nid = nonterm.asText();

	var isStart = nonterm.isStart(grammar)

	extend (this, { grammarEditor: grammarEditor,
			grammar: grammar,
			nonterm: nonterm,
			parentDiv: parentDiv,
			ruleEditor: {} });

	var listItem = this.listItem = $('<div/>').attr(nontermIdAttr,nonterm.id);
	var nontermDiv = this.nontermDiv = $('<div/>').addClass("nonterminal");

	var incomingOpts = $('<ul/>')
	var incomingMenu = $('<ul/>')
	    .addClass("menu")
	    .append($("<li/>")
		    .append($('<a/>').attr("href","#").addClass("editorLink").text("Incoming"))
		    .append(incomingOpts))

	var outgoingOpts = $('<ul/>')
	var outgoingMenu = $('<ul/>')
	    .addClass("menu")
	    .append($("<li/>")
		    .append($('<a/>').attr("href","#").addClass("editorLink").text("Outgoing"))
		    .append(outgoingOpts))

	var mapLink = $('<a/>')
	    .attr("href","#editorMap").addClass("editorLink").text("Map")
	    .click(function(e){ grammarEditor.debugMap.showNeighbors([nonterm.id]) })

	incomingMenu.dropit({beforeShow:function(){
	    incomingOpts.empty()
	    var incoming = nonterm.incomingNonterms(grammar,true)
	    if (incoming.length == 0)
		incomingOpts.append($("<li/>").append($("<span/>")
						      .addClass("undefinedParameter")
						      .text("No incoming links")))
	    else
		for (var i = 0; i < incoming.length; ++i) {
		    var nontermEditor = grammarEditor.nontermEditor[incoming[i].id];
		    incomingOpts.append($("<li/>")
					.append($("<a/>")
						.attr("href","#").text(incoming[i].asText())
						.click((function(nontermEditor){
						    return function(e){
							e.preventDefault();
							nontermEditor.focus()}})(nontermEditor))))
		}
	}})
	
	outgoingMenu.dropit({beforeShow:function(){
	    outgoingOpts.empty()
	    var outgoing = nonterm.outgoingNonterms(true)
	    if (outgoing.length == 0)
		outgoingOpts.append($("<li/>").append($("<span/>")
						      .addClass("undefinedParameter")
						      .text("No outgoing links")))
	    else
		for (var i = 0; i < outgoing.length; ++i) {
		    var nontermEditor = grammarEditor.nontermEditor[outgoing[i].id];
		    outgoingOpts.append($("<li/>")
					.append($("<a/>")
						.attr("href","#").text(outgoing[i].asText())
						.click((function(nontermEditor){
						    return function(e){
							e.preventDefault();
							nontermEditor.focus()}})(nontermEditor))))
		}
	    
	}})

	nontermDiv
	    .append($("<div/>").addClass("editorNavLinks")
		    .append(incomingMenu).append(" ")
		    .append(outgoingMenu).append(" ")
		    .append(mapLink))

	var propDiv = this.propDiv = {};
	var propsDiv = $('<div/>').addClass("NontermProperties")
	nontermDiv.append(propsDiv)

	var fields = 6
	var propColumn = new Array(fields)
	for (var n = 0; n < fields; ++n)
	    propsDiv.append (propColumn[n] = $('<div/>').addClass("NontermPropertiesColumn"))
	var c = 0

	addProperty (this, "Choice @", "id", {type:"text",size:15,keepFocus:false,hasWarning:false,parentDiv:propColumn[c++]}, "The word used to identify this choice.", grammarEditor.nontermRenamingFilter(nonterm))

	this.randomControl =
	    addControl ({ property: "random",
			  parentDiv: propColumn[c++],
			  name: "Player",
			  inputDiv: isStart ? ": Human" : $('<select/>').attr('name','nontermPlayer'+(++nteDummyCount)).append('<option value="0">Human</option><option value="1">Computer</option>'),
			  hasWarning: false,
			  getInput: function(){return isStart ? false : this.inputDiv.val() == "1"},
			  setInput: function(x){if (!isStart) this.inputDiv.val(x ? 1 : 0)},
			  tooltip: "If the Computer is selected to play a particular choice, then the placeholder, prompt and hints will never be displayed to the player: the computer will make the selection randomly. Instead of 'Hint' text for the player, the 'Probability' field can contain the name of a slider-controllable parameter, used by the computer as the probability of selecting the option.",
			  notify: function(random){return nontermEditor.updatePlayer(random)} });

	if (!grammar.isSinglePlayer()) {
	    var role = []
	    for (var r = 1; r <= grammar.roles; ++r) role.push(r)
	    this.roleControl =
		addControl ({ property: "role",
			      parentDiv: propColumn[c++],
			      name: "Turn" + (isStart ? " (after first)" : ""),
			      inputDiv: $('<select/>').attr('name','nontermRole'+(++nteDummyCount)).append('<option value="=">Continues</option><option value="+">Passes to next role</option><option value="-">Passes to previous role</option>' + role.map(function(r){return'<option value="'+r+'">Passes to role #'+r+'</option>'}).join('')),
			      hasWarning: false,
			      getInput: function(){return this.inputDiv.val()},
			      setInput: function(x){this.inputDiv.val(x)},
			      tooltip: "This control selects which role (i.e. which human or computer player in a multiplayer game) has control of this choice. As well as specifying roles directly, you can specify that the controller is the same as for the parent choice ('Turn continues'), or the previous player, or the next player.",
			      notify: function(){nontermEditor.updatePlayer()} });
	}

	addProperty (this, "Limit?", "maxUsage", {type:"text",size:3,parentDiv:propColumn[c++]}, "The Limit field specifies the maximum number of times that the choice " + nid + " may be used in the document. Leave this blank for no limit.");
	addProperty (this, "Hide earlier text?", "commit", {type:"checkbox",hasWarning:false,parentDiv:propColumn[c++]}, "If this box is checked, then after " + nid + " is expanded, any older siblings of this node in the parse tree (that is, any text preceding " + nid + " in the expansion) will be hidden from view. This can be used to create an effect of advancing to the next beat, scene, or chapter. (In single-player mode, the undo history will be cleared: the player will not be able to go back. In multi-player mode there's no undo button anyway.)");
	addProperty (this, "Hide later text?", "pause", {type:"checkbox",hasWarning:false,parentDiv:propColumn[c++]}, "If this box is checked, then all text that appears after " + nid + " in any given expansion will be hidden until " + nid + " has been fully expanded.");

	if (isStart)
	    this.propDiv.id.value.html(nonterm.id);
	else {
	    var inputDiv = nontermEditor.propDiv.id.input
	    inputDiv
		.focus (function(){ inputDiv.val (inputDiv.val().replace(/_/g," ")) })
		.blur (function(){ inputDiv.val (inputDiv.val().replace(/ /g,"_")) })
	}

	this.advancedOptionsDisplayed = false
	function updateAdvancedView(reveal) {
	    if (typeof reveal == 'undefined') reveal = nontermEditor.advancedOptionsDisplayed
	    if (reveal) {
		nontermEditor.preambleControl.containerDiv.show()
		nontermEditor.placeholderControl.containerDiv.show()
		nontermEditor.propDiv.maxUsage.parent.show()
		if (!nonterm.random) {
		    nontermEditor.propDiv.pause.parent.show()
		    nontermEditor.propDiv.commit.parent.show()
		}
		for (var id in nontermEditor.ruleEditor)
		    nontermEditor.ruleEditor[id].showAdvanced()
	    } else {
		if (!nonterm.hasOwnProperty("preamble"))
		    nontermEditor.preambleControl.containerDiv.hide()
		if (!nonterm.hasOwnProperty("placeholder"))
		    nontermEditor.placeholderControl.containerDiv.hide()
		if (!nonterm.hasOwnProperty("maxUsage"))
		    nontermEditor.propDiv.maxUsage.parent.hide()
		if (!nonterm.hasOwnProperty("pause") || nonterm.pause == lw.Nonterm.prototype.pause)
		    nontermEditor.propDiv.pause.parent.hide()
		if (!nonterm.hasOwnProperty("commit") || nonterm.commit == lw.Nonterm.prototype.commit)
		    nontermEditor.propDiv.commit.parent.hide()
		for (var id in nontermEditor.ruleEditor)
		    nontermEditor.ruleEditor[id].hideAdvanced()
	    }
	}
	this.advancedControl = addConfig ({property: "advancedOptionsDisplayed",
					   name: "&nbsp;",  // hack, force width
					   inputDiv: $('<a href="#">'),
					   setInput: function(x){ this.inputDiv.html ($('<i/>').append(x ? "Show less" : "Show more")) },
					   isToggle: true,
					   inputEvent: "click",
					   preventDefaultInputEvent: true,
					   notify: updateAdvancedView })

	this.preambleControl =
	    addControl ({property: "preamble",
			 inputDiv: $('<textarea rows="3"/>'),
			 keepFocus: false,
			 filter: validatePlainText(function(){return nontermEditor.preambleControl.warningDiv},"The preamble is not expanded or preprocessed at all, and so"),
			 tooltip: "This text is called the preamble. It is displayed wherever the choice, " + nid + ", occurs in the narrative, and it goes before any other text or controllers associated with " + nid + ". It does not disappear or change after the player makes a choice."})
	this.preambleDiv = this.preambleControl.inputDiv;

	this.placeholderControl =
	    addControl ({property: "placeholder",
			 inputDiv: $('<textarea rows="2"/>'),
			 keepFocus: false,
			 filter: validatePlainText(function(){return nontermEditor.placeholderControl.warningDiv},"The placeholder is not expanded or preprocessed at all, and so"),
			 tooltip: "This text is called the placeholder. It follows on from the preamble (which is the box above). The placeholder is visible only until the choice, " + nid + ", is expanded; it disappears when the player makes a choice. The texts flow seamlessly together; the player will not see any difference between the placeholder text and preceding text (at least, not until they make a choice)."})
	this.placeholderDiv = this.placeholderControl.inputDiv;

	updateAdvancedView()  // might as well do this here, let the ruleEditors take care of themselves

	this.promptControl =
	    addControl ({property: "prompt",
			 inputDiv: $('<textarea rows="1"/>'),
			 keepFocus: false,
			 filter: validatePlainText(function(){return nontermEditor.promptControl.warningDiv},"The prompt is not expanded or preprocessed at all, and so"),
			 tooltip: "The prompt is the question asked to the player whenever " + nid + " occurs in the narrative, prompting them to choose from the various hints, each of which leads to an expansion for " + nid + "."})
	this.propDiv.prompt = {parent:this.promptControl.containerDiv,input:this.promptControl.inputDiv}  // legacy hack

	var addRuleLink = $('<a href="#">Add an option</a>')
	    .click(function(e){ e.preventDefault(); nontermEditor.addRule(); notify() })

	if (grammarEditor.tooltips)
	    addRuleLink.attr("title","Click to add another hint=>expansion.").tooltip()

	var deleteNontermLink = $('<a href="#">Delete</a>')
	    .click(function(e){
		e.preventDefault();
		var incoming = nonterm.incomingNonterms(grammar,true);
		if (incoming.length) {
		    if (!confirm ("Really, delete "+nonterm.asText()+" from the choicebook? This will not actually delete it but just erase its rules, since it is referenced by other choices ("+incoming.map(function(n){return n.asText()}).join(", ")+")"))
			return;
		    nontermEditor.resetNonterm()
		} else {
		    if (nonterm.isBare() ? false : !confirm ("Really, delete "+nonterm.asText()+" from the choicebook?"))
			return;
		    grammarEditor.deleteNonterm (nonterm);
		}
		notify() })

	var copyNontermLink = $('<a href="#">Duplicate</a>')
	    .click(function(e){
		e.preventDefault();
		grammarEditor.copyNonterm (nonterm);
		notify() })

	if (grammarEditor.tooltips) {
	    deleteNontermLink.attr("title","Click to delete this choice from the choicebook.").tooltip()
	    copyNontermLink.attr("title","Click to copy this choice.").tooltip()
	}

	var deleteOrCopySpan = $('<span/>')
	    .addClass("deleteNonterminal")

	if (!isStart)
	    deleteOrCopySpan
	    .append(deleteNontermLink)
	    .append(" / ")

	deleteOrCopySpan
	    .append(copyNontermLink)
	    .append(" choice")

	var rulesDiv = this.rulesDiv = $('<div/>').addClass("rules");
	nontermDiv
	    .append(rulesDiv)
	    .append($('<span class="addRule"></span>').append(addRuleLink))

	nontermDiv.append(deleteOrCopySpan)

	this.anchor = $('<a/>')
	this.header = $('<h3/>')
	this.setHeader()
	listItem.append(this.header.append(this.anchor)).append(nontermDiv);
	if (typeof (olderSiblingDiv) == 'null')
	    parentDiv.prepend(listItem);
	else if (typeof (olderSiblingDiv) == 'undefined')
	    parentDiv.append(listItem);
	else
	    listItem.insertAfter(olderSiblingDiv);

	// refactoring needed here... no need for addProperty() method or propDiv object
	function addProperty(editor,name,property,controlInfo,tooltip,filter) {
	    var type = controlInfo.type
	    var propDiv = editor.propDiv[property] = {};
	    var inputDiv
	    if (typeof filter == 'undefined')
		filter = function(x){return x}
	    if (type == "textarea")
		inputDiv = $('<textarea rows="1"/>')
	    else
		inputDiv = $('<input type="' + type + '" size="' + controlInfo.size + '"/>')
	    inputDiv.attr("id",nonterm.id+"-"+property)
	    if (type == "text" || type == "textarea") {
		// these are the default controls
	    } else {
		// checkbox
		if (nonterm[property]) inputDiv.attr("checked","checked");
		controlInfo.getInput = function(){
		    return inputDiv.is(":checked")
		}
		controlInfo.setInput = function(x){
		    if (x)
			inputDiv.attr("checked","checked")
		    else
			inputDiv.removeAttr("checked")
		}
	    }
	    propDiv.input = inputDiv;
	    propDiv.info = addControl (extend ({ property: property,
						 name: name,
						 isForm: type != "textarea",
						 inputDiv: inputDiv,
						 filter: filter,
						 tooltip: tooltip },
					      controlInfo))
	    propDiv.parent = propDiv.info.containerDiv
	    propDiv.name = propDiv.info.nameDiv
	    propDiv.value = propDiv.info.valueDiv
	}

	function addControl(h) {
	    var property = ("property" in h) ? h.property : undefined
	    var owner = ("owner" in h) ? h.owner : nonterm
	    var inputDiv = h.inputDiv
	    var info = extend ( { isForm: false,
				  isToggle: false,
				  hasWarning: true,
				  keepFocus: true,
				  property: property,
				  owner: owner,
				  name: property.charAt(0).toUpperCase() + property.substring(1),
				  units: "",
				  parentDiv: nontermDiv,
				  containerType: 'div',
				  filter: function(x){return x},
				  set: function(x){owner[property]=x},
				  get: function(){return (property in owner) ? owner[property] : ""},
				  getInput: function(){return this.isToggle ? !(this.get()) : inputDiv.val()},
				  setInput: function(x){inputDiv.val(x)},
				  inputEvent: "change",
				  preventDefaultInputEvent: false,
				  change: function(e){
				      if (info.preventDefaultInputEvent)
					  e.preventDefault()
				      var oldVal = info.get()
				      var newVal = info.filter(info.getInput())
				      info.setInput(newVal)
				      if (oldVal != newVal) { info.set(newVal); info.notify(newVal); notify() }
				      if (info.keepFocus) info.inputDiv.focus() },
				  notify: function(newVal) { }
				}, h)
	    info.setInput(info.get())
	    if (inputDiv instanceof Object && info.inputEvent in inputDiv)
		inputDiv[info.inputEvent].apply(inputDiv,[info.change])
	    info.controlDiv = info.isForm ? $('<'+info.containerType+'/>').addClass("formWrapper").append($('<form action="#">').append(inputDiv)) : inputDiv
	    info.parentDiv
		.append (info.containerDiv = $('<'+info.containerType+'/>').addClass("NontermControl").addClass(info.property+"PropertyEditor")
			 .append(info.nameDiv = $('<'+info.containerType+'/>').addClass("NontermControlName")
				 .append(info.name))
			 .append(info.valueDiv = $('<'+info.containerType+'/>').addClass("NontermControlValue")
				 .append(info.controlDiv)))
	    if (info.units.length)
		info.valueDiv.append(info.units)
	    if (info.hasWarning)
		info.containerDiv.append(info.warningDiv = $('<'+info.containerType+'/>').addClass("NontermControlWarning"))
	    if (grammarEditor.tooltips)
	    	info.containerDiv.attr("title",info.tooltip).tooltip()

	    return info
	}
	this.addControl = addControl

	function addConfig(h) { return addControl(extend ({owner:nontermEditor}, h)) }
	this.addConfig = addConfig

	for (var i = 0; i < nonterm.rules.length; ++i)
	    this.addRuleDiv (nonterm.rules[i]);
	this.createRuleSortable()

	this.updatePlayer();
    }

    lw.NontermEditor.prototype.createRuleSortable = function() {
	var nonterm = this.nonterm;
	var ruleParentDiv = this.rulesDiv;
	var notify = this.grammarEditor.notifyChange
	ruleParentDiv.sortable
	({axis: "y",
	  update: function(event,ui) {
	      var rule = {};
	      for (var i = 0; i < nonterm.rules.length; ++i)
		  rule[nonterm.rules[i].id] = nonterm.rules[i];
	      nonterm.rules = ruleParentDiv.sortable("toArray",{attribute:ruleIdAttr}).map(function(id){return rule[id]});
	      notify()
	    }});
    }

    lw.NontermEditor.prototype.destroyRuleSortable = function() {
	this.rulesDiv.sortable("destroy");
    }

    lw.NontermEditor.prototype.focus = function() {
	this.header.click()
	// setting the document.location doesn't quite work sometimes, probably because animation rolls content away
	var newLoc = "#" + nontermAnchorPrefix + this.nonterm.id
	function setLocation() { document.location = newLoc }
	window.setTimeout(setLocation,400)
//	setLocation()
    }

    function plural(n,noun) { return n + " " + noun + (n == 1 ? "" : "s") }
    lw.NontermEditor.prototype.setHeader = function() {
	this.anchor.attr("name",nontermAnchorPrefix + this.nonterm.id)
	this.anchor.empty().append(this.nonterm.asText())
	var player = this.nonterm.random ? "computer" : "human"
	if (this.grammar.roles > 1) {
	    switch (this.nonterm.role) {
	    case "+": player = "next " + player; break;
	    case "-": player = "previous " + player; break;
	    case "=": player = "same " + player; break;
	    default: player = "#" + this.nonterm.role + " " + player; break;
	    }
	    if (this.nonterm.isStart(this.grammar))
		player = "#1 human on first turn, then " + player
	}
	var orphan = this.nonterm.isOrphan(this.grammar) ? "orphan, " : ""
	var bare = this.nonterm.isBare() ? ", bare" : ""
	var rules = this.nonterm.rules.length
	var loose = this.nonterm.looseEnds()
	var rulesText = plural(rules,"rule")
	if (loose)
	    rulesText = (loose == rules) ? plural(rules,"empty rule") : (rulesText + ", " + loose + " empty")
	this.anchor.append (" (" + player + "; " + orphan + rulesText + bare + ")")
    }

    lw.NontermEditor.prototype.updatePlayer = function(random) {
	if (typeof random == 'undefined') random = this.nonterm.random;
	var newClass
	if (random) {
	    this.propDiv.prompt.parent.hide()
	    this.propDiv.pause.parent.hide()
	    this.propDiv.commit.parent.hide()
	    for (var id in this.ruleEditor) {
		this.ruleEditor[id].hintName.html("Probability");
		this.ruleEditor[id].hintDiv.attr("title","This is the probability (relative frequency) with which the computer will choose this option. Leave blank to sample this option with a relative frequency of 1.").tooltip()
		this.ruleEditor[id].rhsDiv.attr("title","This is the text that will be generated, if the computer randomly picks this option.").tooltip()
		this.ruleEditor[id].timesHiddenDiv.attr("title","This represents the number of times that this particular option will be avoided by the computer. Following that, the option will be randomly selected with the relative frequency indicated. Leave blank to have the option always be available to the computer.").tooltip()

	    }

	    newClass = "computerHint"

	} else {
	    this.propDiv.prompt.parent.show()
	    if (this.advancedOptionsDisplayed) {
		this.propDiv.pause.parent.show()
		this.propDiv.commit.parent.show()
	    }
	    for (var id in this.ruleEditor) {
		this.ruleEditor[id].hintName.html("Hint");
		this.ruleEditor[id].hintDiv.attr("title","This is the text that will be presented to the player as a selectable option.").tooltip()
		this.ruleEditor[id].rhsDiv.attr("title","This is the text that will be generated, if the player selects this option.").tooltip()
		this.ruleEditor[id].timesHiddenDiv.attr("title","This represents the number of times that this particular option will be hidden from the player. Following that, the option will be visible in the list of options. Leave blank to have the option always be shown to the player.").tooltip()
	    }
	    newClass = "playerHint"
	}

	for (var id in this.ruleEditor) {
	    this.ruleEditor[id].hintInput
		.removeClass("playerHint computerHint")
		.addClass(newClass)
	    this.ruleEditor[id].validateHint(random)
	}
	this.propDiv.prompt.input
	    .removeClass("playerHint computerHint")
	    .addClass(newClass)
	this.setHeader()
	return random;
    }

    function appendFormWrapper(parentDiv,inputDiv) {
	var formDiv = $('<form action="#">').append(inputDiv);
	parentDiv.append(formDiv);
    }

    lw.NontermEditor.prototype.resetNonterm = function() {
	var nontermEditor = this;
	var nonterm = this.nonterm;

	delete nonterm.preamble;
	delete nonterm.placeholder;
	extend (nonterm, new LetterWriter.Nonterm (nonterm.id, nonterm.defaultPrompt, nonterm.anonymous))

	this.preambleDiv.val(nonterm.preamble)
	this.placeholderDiv.val(nonterm.placeholder)
	this.propDiv.prompt.input.val(nonterm.prompt)
	this.propDiv.maxUsage.input.val("maxUsage" in nonterm ? nonterm.maxUsage : "")
	
	function updateCheckbox(property) {
	    if (nonterm[property])
		nontermEditor.propDiv[property].input.attr("checked","checked")
	    else
		nontermEditor.propDiv[property].input.removeAttr("checked")
	}

	updateCheckbox("pause")
	updateCheckbox("commit")

	this.randomControl.setInput (nonterm.random)

	for (var ruleId in this.ruleEditor)
	    this.ruleEditor[ruleId].rule.remove()
	this.ruleEditor = []

	this.addRule()
    }

    lw.NontermEditor.prototype.addRule = function() {
	this.destroyRuleSortable()
	this.addRuleDiv (this.nonterm.addEmptyRule());
	this.createRuleSortable()
	this.updatePlayer();
    }

    function validatePlainText(warningDivFunc,prefix) {
	return function(text,oldText) {
	    var warningDiv = warningDivFunc()
	    if (/[\S]/.test(text)) {
		var errorPrefix = prefix + " should not contain any \"special\" characters.  These special characters include square braces [], curly braces {}, =, $, @, and #. If you have to include those, you should prefix them with a backslash \"\\\". The specific error encountered was as follows:"
		try {
		    LetterWriter.parser.parse (text, "text");
		} catch (e) {
		    showWarningIcon (warningDiv, errorPrefix + buildErrorMessage(e))
		    return typeof(oldText)=='undefined' ? text : oldText
		}
		hideWarningIcon (warningDiv)
	    }
	    return text;
	}
    }

    lw.NontermEditor.prototype.addRuleDiv = function(rule) {
	var grammar = this.grammar;
	var grammarEditor = this.grammarEditor;
	var nontermEditor = this;
	var notify = grammarEditor.notifyChange;
	var nonterm = nontermEditor.nonterm;

	var ruleDiv = $('<div/>').addClass("rule").attr(ruleIdAttr,rule.id);

	var deleteLinkDiv = $('<a href="#">Delete option</a>')
	var deleteDiv = $('<div/>').addClass("deleteRule").append(deleteLinkDiv)

	if (grammarEditor.tooltips)
	    deleteDiv.attr("title","Click to delete this option.").tooltip()

	deleteLinkDiv.click (function(e){
	    e.preventDefault();
	    if (rule.isBare() || confirm ("Really, delete option"+(/\S/.test(rule.hint)?(' "'+rule.hint+'"'):"")+"?")) {
		nonterm.rules.splice (indexOf (nonterm.rules, rule), 1);
		delete nontermEditor.ruleEditor[rule.id];
		ruleDiv.remove();
		if (nonterm.rules.length == 0)
		    nontermEditor.addRule();  // give it at least one empty rule
		grammarEditor.refreshHeaders()
		notify() } })

	var rhsGet = function() { return rule.rhsAsText() }

	var hintInputDiv = $('<textarea rows="1"/>').attr({name: "hint" + rule.id})
	var rhsInputDiv = $('<textarea rows="4"/>').attr({name: "rhs" + rule.id})
	var limitInputDiv = $('<input type="text" size="3"/>').attr({name: "limit" + rule.id})
	var hiddenInputDiv = $('<input type="text" size="3"/>').attr({name: "hidden" + rule.id})

	function validateHint(random) {
	    if (typeof random == 'undefined') random = nonterm.random;
	    var hintWarningDiv = ruleEditor.hintInputWarning
	    if (random) {
		if (/[\S]/.test(rule.hint)) {
		    var errorPrefix = "For choices whose expansion is chosen by the computer, the hint should be a number (representing a probability or a relative rate) or the name of an attribute. This does not look like a number or the name of an attribute, at least not within this program's limited parsing abilities. The specific error message encountered was as follows: "
		    var weightFunc;
		    try {
			weightFunc = LetterWriter.parser.parse (rule.hint, "param_expr");
		    } catch (e) {
			showWarningIcon (hintWarningDiv, errorPrefix + buildErrorMessage(e))
			return
		    }
		    var bad = weightFunc.getBadParams(grammar)
		    if (bad.missing.length)
			showWarningIcon (hintWarningDiv, "Some parameters in this expression (" + bad.missing.map(function(x){return"$"+x}).join(", ") + ") are not referenced anywhere in the choicebook, so they are probably not going to work the way you intended.")
		    else if (bad.unsafe.length)
			showWarningIcon (hintWarningDiv, "Some parameters (" + bad.unsafe.map(function(x){return"$"+x}).join(", ") + ") are not assigned to sliders; they are only assigned as \"side-effects\" of other choice expansions. As such, I cannot (without a more elaborate analysis) guarantee that they will have a meaningful probabilistic value, or indeed any value at all, at the time this rule is expanded. I hope you know what you're doing.")
		    else
			hideWarningIcon (hintWarningDiv)
		} else
		    hideWarningIcon (hintWarningDiv)
	    } else  // !random
		validatePlainText(function(){return hintWarningDiv},"For choices whose expansion is chosen by the player, the hint will not itself be expanded, and so")(rule.hint)
	}

	function hintInputChange(e){
	    rule.hint = e.target.value;
	    validateHint()
	    nontermEditor.setHeader()
	    notify() }

	function warnEmptyRhs() {
	    var rhsWarningDiv = ruleEditor.rhsInputWarning
	    showWarningIcon (rhsWarningDiv, "This expansion is empty; it will disappear when the player selects it. You might want at least some text here.")
	}

	function rhsInputChange(e) {
	    var oldRhs = rule.rhs;
	    if (e.type == "change") {  // prevent event firing a second time for autocompletechange
		var newRhsText = e.target.value;
		var rhsWarningDiv = ruleEditor.rhsInputWarning
		var newRhs;
		if (newRhsText == "") {
		    warnEmptyRhs()
		    newRhs = []
		} else {
 		    try {
 			newRhs = LetterWriter.parser.parse (newRhsText, "ui_rhs");
 			hideWarningIcon (rhsWarningDiv)
		    } catch (err) {
			var msg = buildErrorMessage(err);
			console.log("Syntax error in expansion of @" + rule.lhs.id + ":\n" + msg);
			showWarningIcon (rhsWarningDiv, "It looks like there might be a syntax error in this expansion. The error reported by the parser was as follows:\n" + msg)
			// TODO: make parser more forgiving, e.g. "@," or "@@@@" or "@ " should not trigger a syntax error
			// TODO: if there is a syntax error and the text contains special characters ("{}[]" etc), try re-parsing with characters escaped
			return;
		    }
		}

		if (typeof(newRhs) != 'undefined') {
		    function scanRhsForNewSymbols(rhs,callback) {
			for (var i = rhs.length - 1; i >= 0; --i) {
			    var newSym = rhs[i];
			    if (newSym instanceof LetterWriter.NontermReference) {
				if (newSym.nonterminal.id in grammar.nonterm)
				    newSym.nonterminal = grammar.nonterm[newSym.nonterminal.id]
				else {
				    callback (newSym)
				    var newNonterm = newSym.nonterminal;
				    for (var j = 0; j < newNonterm.rules.length; ++j)
					scanRhsForNewSymbols (newNonterm.rules[j].rhs, callback) } } } }

		    // rename anonymous nonterminals
		    scanRhsForNewSymbols(newRhs,function(sym){
			var newNonterm = sym.nonterminal;
			if (newNonterm.anonymous)
			    newNonterm.id = grammar.createAnonId((sym.random()
								  ? "computer_"
								  : "player_") + anonymousNonterminalPrefix,
								 "_" + nonterm.id) })

		    // incorporate all new nonterminals into grammar.
		    // those flagged as anonymous will have the modifiers copied into their properties
		    var grammarChanged = false
		    scanRhsForNewSymbols(newRhs,function(sym){
			grammarChanged = true
			grammarEditor.addNonterm (sym, nonterm)  // migrates anonymous modifiers into nonterm properties
			// clear the anonymous flag
			sym.nonterminal.anonymous = false })

		    rule.rhs = newRhs;
		    rhsInputDiv.val (rule.rhsAsText());

		    var deletedIds = {}
		    for (var i = 0; i < oldRhs.length; ++i)
			if (oldRhs[i] instanceof LetterWriter.NontermReference && oldRhs[i].nonterminal.isOrphan(grammar) && oldRhs[i].nonterminal.isBare() && !(oldRhs[i].nonterminal.id in deletedIds)) {
			    deletedIds[oldRhs[i].nonterminal.id] = true
			    grammarChanged = true
			    grammarEditor.deleteNonterm(oldRhs[i].nonterminal)
			}

		    grammarEditor.refreshHeaders()

		    notify()
		    if (grammarChanged)
			nontermEditor.focus()
		}
	    }
	}

	rhsInputDiv.autocomplete ({ change: rhsInputChange,
				    source: function(request,response) {
					var matchNonterm = /^(.*)(@[a-zA-Z0-9]*)$/.exec (request.term)
					var suggestions = []
					if (matchNonterm && matchNonterm[2].length >= 1) {
					    var typed = matchNonterm[1]
					    var prefix = matchNonterm[2]
					    for (var i = 0; i < grammar.nonterms.length; ++i) {
						var nonterm = grammar.nonterms[i];
						var tag = nonterm.asText()
						if (tag.length >= prefix.length && tag.substring(0,prefix.length) == prefix.toLowerCase())
						    suggestions.push ( {label: tag,
									value: typed + tag + " "} ) } }
					else {
					    var matchParam = /^(.*)($[a-zA-Z0-9]*)$/.exec (request.term)
					    if (matchParam) {
						var typed = matchParam[1]
						var prefix = matchParam[2]
						// TODO: autocomplete $param names here...
					    }
					}
					response(suggestions) }})

	function limitInputChange(e){
	    var newMaxUsage = e.target.value;
	    if (newMaxUsage > 0) rule.maxUsage = newMaxUsage
	    else delete rule.maxUsage
	    notify() }

	function hiddenInputChange(e){
	    var newTimesHidden = e.target.value;
	    if (newTimesHidden > 0) rule.timesHidden = newTimesHidden
	    else delete rule.timesHidden
	    notify() }

	var ruleEditor
	    = this.ruleEditor[rule.id]
	    = { rule: ruleDiv,
		hintInput: hintInputDiv,
		rhsInput: rhsInputDiv,
		validateHint: validateHint,
		controlInfo: {},
		showAdvanced: function(){this.controlInfo.maxUsage.containerDiv.show();
					 this.controlInfo.timesHidden.containerDiv.show()},
		hideAdvanced: function() {
		    if (!rule.hasOwnProperty("maxUsage"))
			this.controlInfo.maxUsage.containerDiv.hide();
		    if (!rule.hasOwnProperty("timesHidden"))
			this.controlInfo.timesHidden.containerDiv.hide() } }

	function addRuleControl(info) {
	    ruleEditor.controlInfo[info.property] = nontermEditor.addControl (extend ({owner:rule,parentDiv:ruleDiv}, info))
	    ruleEditor[info.property+"Name"] = ruleEditor.controlInfo[info.property].nameDiv
	    ruleEditor[info.property+"Div"] = ruleEditor.controlInfo[info.property].containerDiv
	    ruleEditor[info.property+"InputWarning"] = ruleEditor.controlInfo[info.property].warningDiv
	}

	addRuleControl ({property: "hint",
			 name: "Hint ",
			 tooltip: "This is the text that will be presented to the player as a selectable option.",
			 inputDiv: hintInputDiv,
			 keepFocus: false,
			 change: hintInputChange})

	addRuleControl ({property: "rhs",
			 name: "Expands to ",
			 tooltip: "This is the text that will be generated, if the player selects this option.",
			 get: rhsGet,
			 inputDiv: rhsInputDiv,   // this one has to keepFocus; rhs modifications can disrupt grammar
			 change: rhsInputChange})

	addRuleControl ({property: "maxUsage",
			 name: "Limit?",
			 tooltip: "This is the maximum number of times this option can be used. Leave blank to unlimit.",
			 units: "uses",
			 inputDiv: limitInputDiv,
			 keepFocus: false,
			 change: limitInputChange})

	addRuleControl ({property: "timesHidden",
			 name: "Hidden?",
			 tooltip: "This represents the number of times that this particular option will be " + (nonterm.random ? "avoided by the computer" : "hidden from the player") + ". Following that, the option will be included in the list. Leave blank to have the option always be available.",
			 units: "times",
			 inputDiv: hiddenInputDiv,
			 keepFocus: false,
			 change: hiddenInputChange})

	if (rule.rhs.length == 0)
	    warnEmptyRhs()

	ruleDiv.append (deleteDiv)

	this.rulesDiv.append (ruleDiv)

	if (!nontermEditor.advancedOptionsDisplayed)
	    ruleEditor.hideAdvanced()
    }

    lw.NontermEditor.prototype.replaceParams = function(oldParam,newParam) {
	if (this.nonterm.random)
	    for (var i = 0; i < this.nonterm.rules.length; ++i) {
		var rule = this.nonterm.rules[i];
		if (rule.hasParam(oldParam)) {
		    rule.replaceParam(oldParam,newParam)
		    var hintInputDiv = this.ruleEditor[rule.id].hintInput;
		    hintInputDiv.val (rule.hint)
		}
	    }
    }

    lw.NontermEditor.prototype.refreshExpansions = function() {
	for (var i = 0; i < this.nonterm.rules.length; ++i) {
	    var rule = this.nonterm.rules[i]
	    this.ruleEditor[rule.id].rhsInput.val(rule.rhsAsText())
	}
	this.setHeader()
    }

    var warningIconPath = "img/warning.png"
    function showWarningIcon(div,message) {
	div.empty().append($('<img/>').attr("src",warningIconPath)).attr("title",message).tooltip()
    }

    function hideWarningIcon(div) {
	div.empty()
    }

    // GrammarEditor
    var nontermIdAttr = "nontermID";
    var paramIdAttr = "paramID";
    var ruleIdAttr = "ruleID";
    lw.GrammarEditor = function(grammar,args) {
	var grammarEditor = this;
	this.notifyChangeInner = function(){}
	this.notifyChange = function() { grammarEditor.notifyChangeInner() }
	var notify = this.notifyChange
	var parentIdPrefix = ("parentIdPrefix" in args) ? args.parentIdPrefix : undefined;

	if (typeof parentIdPrefix == 'undefined' || parentIdPrefix == "")
	    parentIdPrefix = "editor";
	var parentDiv = $("#"+parentIdPrefix+"List");
	var paramsParentDiv = $("#"+parentIdPrefix+"Params");
	var templateDiv = $("#"+parentIdPrefix+"Template");
	var mapDiv = $("#"+parentIdPrefix+"Map");
	var titleInput = $("#"+parentIdPrefix+"Title")
	var undoInput = $("#"+parentIdPrefix+"UndoWait");
	var undoWaitMultiplier = $("#"+parentIdPrefix+"UndoPercentIncrease")
	var miscStats = $("#"+parentIdPrefix+"MiscStats")

	extend (this, args);
	this.grammar = grammar;
	this.parentIdPrefix = parentIdPrefix;
	this.parentDiv = parentDiv;
	this.paramsParentDiv = paramsParentDiv;

	var titleWarningDiv
	var titleValidator = validatePlainText(function(){return titleWarningDiv},"The title is not expanded or preprocessed at all, and so")
	titleInput
	    .val(grammar.title)
	    .append(titleWarningDiv = $('<div/>').addClass("NontermControlWarning"))
	    .change(function(){
		grammar.title = titleValidator (titleInput.val(), grammar.title)
		notify() })

	undoInput
	    .val((("wait" in grammar.undo) ? grammar.undo.wait : initialUndoRechargeTime) / 1000)
	    .change(function(){ var w = parseInt (undoInput.val())
				if (isNaN(w) || w < 0) w = initialUndoRechargeTime / 1000
				undoInput.val ((grammar.undo.wait = w * 1000) / 1000)
				notify() })

	undoWaitMultiplier.html(undoRechargeTimeMultiplierPercent)

	miscStats.empty()
	miscStats.append('<i>Roles:</i> ' + grammar.roles + '<br>')
	if (grammar.hasScoreParam())
	    miscStats.append('<i>Score parameter:</i> <code>' + grammar.scoreParamType + grammar.scoreParam + '</code><br>')

	if (templateDiv.length)
	    this.addNotify (function() { templateDiv[0].value = grammar.toCanonicalString() })

	function showDebugMap() {
	    grammarEditor.debugMap = new lw.DebugMapView (grammarEditor, mapDiv[0])
	}
	grammarEditor.showDebugMap = showDebugMap

	if (mapDiv.length) {
	    this.addNotify (showDebugMap)
	    showDebugMap()
	}

	this.sortLink = $("<a/>").attr("href","#").addClass("editorLink")
	this.sortLink.insertBefore (parentDiv)

	function alphabetSort(e) {
	    e && e.preventDefault()
	    if (!grammarEditor.sortedByAlphabet) {
		grammarEditor.destroyNontermAccordion()
		var newChildOrder =
		    parentDiv.children().sort (function(a,b) {
			var ida = a.getAttribute(nontermIdAttr), idb = b.getAttribute(nontermIdAttr)
			return ida < idb ? -1 : (ida > idb ? +1 : 0) })
		newChildOrder.detach()
		parentDiv.append (newChildOrder)
		grammarEditor.sortedByAlphabet = true
		grammarEditor.createNontermAccordion()
	    }
	    grammarEditor.sortLink.text ("Custom sort")
	    grammarEditor.sortLink.click (customSort)
	}

	function customSort(e) {
	    e && e.preventDefault()
	    if (grammarEditor.sortedByAlphabet) {
		grammarEditor.destroyNontermAccordion()
		var newChildOrder =
		    parentDiv.children().sort (function(a,b) {
			var idxa = indexOf(grammar.nonterms,
					   grammar.nonterm[a.getAttribute(nontermIdAttr)])
			var idxb = indexOf(grammar.nonterms,
					   grammar.nonterm[b.getAttribute(nontermIdAttr)])
			return idxa < idxb ? -1 : (idxa > idxb ? +1 : 0) })
		newChildOrder.detach()
		parentDiv.append (newChildOrder)
		grammarEditor.sortedByAlphabet = false
		grammarEditor.createNontermAccordion()
	    }
	    grammarEditor.sortLink.text ("Alphabetic sort")
	    grammarEditor.sortLink.click (alphabetSort)
	}

	this.sortedByAlphabet = false
	customSort()

	this.nontermEditor = {};
	for (var i = 0; i < grammar.nonterms.length; ++i) {
	    var nonterm = grammar.nonterms[i];
	    this.addNontermEditor (nonterm, undefined);  // sibling div = undefined; new div will go at the end
	}

	this.createNontermAccordion();

	$("#addNontermLink")
	    .click(function(e,ui){
		e.preventDefault();
		grammarEditor.addNonterm
		(new lw.NontermReference
		 (new lw.Nonterm (grammar.createAnonId(), undefined, false),
		  {}));
		notify() })

	this.paramContainerDivs = []
	for (var i = 0; i < grammar.params.length; ++i) {
	    var param = grammar.params[i];
	    this.addParamDiv(param,i+1)
	}

	this.createParamSortable();

	$("#addSliderLink")
	    .click(function(e,ui){
		e.preventDefault();
		var param = new lw.Param (grammar.createNewParamId(), 0.5, LetterWriter.defaultNever, LetterWriter.defaultAlways)
		grammar.params.push(param)
		grammarEditor.addParamDiv(param,grammar.params.length)
		notify() })
	    .attr("title","Click to add a new slider-controllable attribute. This by itself will not make the attribute do anything; you also need to mark some choices as 'random', and then enter the name of the attribute in the 'Option (computer)' field for some of that choice's expansions. This will signal to the computer that it should use the named attribute to control those random expansions.").tooltip()

    }

    lw.GrammarEditor.prototype.tooltips = true;

    lw.GrammarEditor.prototype.createNontermAccordion = function() {
	var grammar = this.grammar;
	var parentDiv = this.parentDiv;
	var notify = this.notifyChange

	parentDiv.accordion({
	    header: "> div > h3",
	    heightStyle: "content",
	    event: "click hoverintent"
	});

	if (!this.sortedByAlphabet)
	    parentDiv.sortable({
		axis: "y",
		// if uncommented, nonterminal div can only be dragged by header bar
		//	    handle: "h3",
	    update: function(event,ui) {
		grammar.nonterms = parentDiv.sortable("toArray",{attribute:nontermIdAttr}).map(function(id){return grammar.nonterm[id]});
		notify()
	    }});
    }

    lw.GrammarEditor.prototype.destroyNontermAccordion = function() {
	var parentDiv = this.parentDiv;
	if (!this.sortedByAlphabet)
	    parentDiv.sortable("destroy");
	parentDiv.accordion("destroy");
    }

    lw.GrammarEditor.prototype.createParamSortable = function() {
	var grammar = this.grammar;
	var paramsParentDiv = this.paramsParentDiv;
	var notify = this.notifyChange
	this.paramsParentDiv.sortable
	({axis: "y",
	  update: function(event,ui) {
	      var param = {};
	      for (var i = 0; i < grammar.params.length; ++i)
		  param[grammar.params[i].id] = grammar.params[i];
	      grammar.params = paramsParentDiv.sortable("toArray",{attribute:paramIdAttr}).map(function(id){return param[id]});
	      notify()
	    }});
    }

    lw.GrammarEditor.prototype.destroyParamSortable = function() {
	this.paramsParentDiv.sortable("destroy");
    }

    lw.GrammarEditor.prototype.addParamDiv = function(param,pos) {
	var grammarEditor = this;
	var grammar = this.grammar;
	var notify = grammarEditor.notifyChange

	var paramDiv = $('<input type="text"/>').
	    attr("name","paramName#"+pos).attr("value",param.name);

	paramDiv.change(function(e,ui){
	    var oldId = param.id, oldName = param.name, newName = e.target.value
	    // sanitize newName
	    newName = sanitizeId(newName)
	    var newId = newName.toLowerCase()
	    paramDiv.val(newName)
	    // update
	    if (newName != oldName) {
		if (newId == oldId) {
		    param.name = newName
		    notify()
		} else if (typeof (grammar.findParam(newId)) != "undefined") {
		    alert ("You cannot change the name of this parameter from '" + oldName + "' to '" + newName + "', because there is already a parameter called '" + newName + "'");
		    paramDiv.val(oldName)
		} else {
		    grammarEditor.destroyParamSortable()
		    for (var i = 0; i < grammar.nonterms.length; ++i)
			grammarEditor.nontermEditor[grammar.nonterms[i].id].replaceParams (oldName, newName)
		    paramContainerDiv.attr(paramIdAttr,newName)
		    param.id = newId
		    param.name = newName
		    grammarEditor.createParamSortable()
		    notify()
		}
	    }
	})

	var paramMinDiv = $('<input type="text"/>')
	    .attr("name","paramMin#"+pos).attr("value",param.min)
	    .change(function(e,ui){param.min = e.target.value; notify() })

	var paramMaxDiv = $('<input type="text"/>')
	    .attr("name","paramMax#"+pos).attr("value",param.max)
	    .change(function(e,ui){param.max = e.target.value; notify() })

	var paramInitialValueDiv = $('<span/>');
	var paramLabelSpan = $('<span/>').addClass("editorSliderLabel").append(' ').append(paramInitialValueDiv).append(' ')
	function updateInitialValue(){paramInitialValueDiv.empty().append('Starting level: '+Math.round(100*param.init)+'%')}
	updateInitialValue()
	var paramSliderDiv = $('<div/>').addClass("editorSlider")
	    .slider({ min: 0,
		      max: 1,
		      value: param.init,
		      step: .01,
		      change: function(event,ui) {
			  param.init = ui.value;
			  updateInitialValue()
		      }})

	var paramDeleteLink = $('<a href="#">Delete this slider</a>')
	if (grammarEditor.tooltips)
	    paramDeleteLink.attr("title","Click to delete this slider.").tooltip()
	paramDeleteLink.click(function(e,ui){
	    e.preventDefault();
	    grammarEditor.destroyParamSortable()
	    if (!grammar.usesParam(param.id) || confirm ("Really, delete slider for $"+param.id+"?")) {
		grammar.params.splice (indexOf (grammar.params, param), 1)
		paramContainerDiv.remove()
	    }
	    grammarEditor.createParamSortable()
	    notify()
	})

	var paramContainerDiv = $('<div/>').addClass("editorSliderContainer")
	    .attr(paramIdAttr,param.id)
	    .append($('<form/>')
		    .append("<i>Name:</i> $").append(paramDiv)
		    .append(" <i>Label at 0%:</i> ").append(paramMinDiv)
		    .append(" <i>Label at 100%:</i> ").append(paramMaxDiv)
		    .append(paramLabelSpan))
	    .append($('<span/>').addClass("editorSliderDeleteLink").append(paramDeleteLink))
	    .append($('<div/>').addClass("editorSliderAndLabel").append(paramSliderDiv))
	this.paramContainerDivs.push(paramContainerDiv);
	this.paramsParentDiv.append(paramContainerDiv);
    }

    lw.GrammarEditor.prototype.remove = function() {
	this.destroyNontermAccordion()
	for (var id in this.nontermEditor)
	    this.nontermEditor[id].listItem.remove()
	for (var i = 0; i < this.paramContainerDivs.length; ++i)
	    this.paramContainerDivs[i].remove()
	this.parentDiv.empty()
	this.paramsParentDiv.empty()
	this.sortLink.remove()
    }

    lw.GrammarEditor.prototype.addNontermEditor = function(nonterm,siblingDiv) {
	if (this.sortedByAlphabet) {
	    var divs = this.parentDiv.children()
	    siblingDiv = null
	    for (var i = 0; i < divs.length; ++i)
		if (divs[i].getAttribute(nontermIdAttr) < nonterm.id)
		    siblingDiv = divs[i];
	    else
		break;
	}
	var nontermEditor = new lw.NontermEditor (this, nonterm, this.parentDiv, siblingDiv);
	this.nontermEditor[nonterm.id] = nontermEditor;
    }

    lw.GrammarEditor.prototype.refreshExpansions = function() {
	for (var id in this.nontermEditor)
	    this.nontermEditor[id].refreshExpansions()
    }

    lw.GrammarEditor.prototype.refreshHeaders = function() {
	for (var id in this.nontermEditor)
	    this.nontermEditor[id].setHeader()
    }

    lw.GrammarEditor.prototype.renameNonterm = function(oldId,newId) {
	var grammar = this.grammar
	var nonterm = grammar.nonterm[oldId]
	var oldNontermEditor = this.nontermEditor[oldId]
	this.destroyNontermAccordion()
	delete this.nontermEditor[oldId]
	oldNontermEditor.listItem.css("display","none");
	nonterm.id = newId
	delete grammar.nonterm[oldId]
	grammar.nonterm[newId] = nonterm
	var newNontermEditor = new lw.NontermEditor (this, nonterm, this.parentDiv, oldNontermEditor.listItem)
	this.nontermEditor[newId] = newNontermEditor
	this.refreshExpansions()
	oldNontermEditor.listItem.remove()
	this.createNontermAccordion()
	newNontermEditor.focus()
    }

    lw.GrammarEditor.prototype.deleteNonterm = function(nonterm) {
	var grammar = this.grammar
	var id = nonterm.id
	this.destroyNontermAccordion()
	grammar.nonterms.splice (indexOf(grammar.nonterms,nonterm), 1)
	delete grammar.nonterm[id]
	var nontermEditor = this.nontermEditor[id]
	nontermEditor.listItem.remove()
	delete this.nontermEditor[id]
	this.createNontermAccordion()
    }

    lw.GrammarEditor.prototype.addNonterm = function(nontermRef,sibling) {
	var nonterm = nontermRef.nonterminal;
	if (nonterm.anonymous) {
	    extend (nonterm, nontermRef.props);  // migrate all the properties into the nonterminal
	    nontermRef.props = {};
	    nontermRef.buildAccessors();  // a bit hacky, but the compiler doesn't know about the editor, so that's how it is
	}
	else
	    nonterm.addEmptyRule();  // give new nonterminal an empty rule or it won't be displayed
	this.addNontermInner(nonterm,sibling)
    }

    lw.GrammarEditor.prototype.addNontermInner = function(nonterm,sibling) {
	var grammar = this.grammar;
	var siblingDiv;
	if (typeof(sibling) == 'undefined')
	    sibling = grammar.nonterms[grammar.nonterms.length - 1]
	grammar.nonterm[nonterm.id] = nonterm;
	grammar.nonterms.splice (indexOf(grammar.nonterms,sibling) + 1, 0, nonterm);
	var siblingEditor = this.nontermEditor[sibling.id];
	siblingDiv = siblingEditor.listItem;
	this.destroyNontermAccordion();
	this.addNontermEditor(nonterm,siblingDiv);
	this.createNontermAccordion();
    }

    lw.GrammarEditor.prototype.copyNonterm = function(sibling) {
	var nonterm = sibling.clone(this.grammar)
	this.addNontermInner(nonterm,sibling)
    }

    lw.GrammarEditor.prototype.nontermRenamingFilter = function(nonterm) {
	var grammarEditor = this;
	var grammar = grammarEditor.grammar;
	return function(newId) {
	    var oldId = nonterm.id;
	    // sanitize newId
	    newId = sanitizeId(newId).toLowerCase()
	    grammarEditor.nontermEditor[oldId].propDiv.id.input.val(newId)
	    // update
	    if (newId != oldId)
		if (newId in grammar.nonterm) {
		    alert ("You cannot change the name of this choice from @" + oldId + " to @" + newId + ", because there is already a choice called @" + newId + ".");
		    grammarEditor.nontermEditor[oldId].propDiv.id.input.val(oldId)
		    newId = oldId
		} else
		    grammarEditor.renameNonterm(oldId,newId)
	    return newId
	}
    }

    lw.GrammarEditor.prototype.addNotify = function(f) { this.notifyChangeInner = chain (this.notifyChangeInner, f) }
    lw.GrammarEditor.prototype.warnChange = function(warningDiv,msg,f) {
	this.warnChangeFunction = function() { showWarningIcon (warningDiv, msg) }
	this.addNotify (this.warnChangeFunction)
	if (typeof f != 'undefined')
	    this.addNotify (f)
    }

    // Rule
    lw.Rule = function(id,hint,lhs,rhs,mods) {
	extend (this, { id: id,
			lhs: lhs,
			rhs: rhs })
	if (typeof hint != "undefined")
	    this.hint = hint;
	else if (lhs.anonymous)
	    this.hint = ""
	if (("maxUsage" in mods) && mods.maxUsage > 0)
	    this.maxUsage = mods.maxUsage;
	if (("timesHidden" in mods) && mods.timesHidden > 0)
	    this.timesHidden = mods.timesHidden;
    }
    lw.Rule.prototype.hint = "1";  // for computer player

    lw.Rule.prototype.clone = function() {
	var rule = new lw.Rule (this.id, this.hint, this.lhs, [], this, {})
	extend (rule, this, true)
	for (var i = 0; i < this.rhs.length; ++i)
	    rule.rhs.push (this.rhs[i].clone())
	return rule;
    }

    // bare: no text or RHS
    lw.Rule.prototype.isBare = function() {
	return (this.hint == lw.Rule.prototype.hint || this.hint == "") && this.rhs.length == 0
    }

    // loose end: no RHS
    lw.Rule.prototype.isLooseEnd = function() {
	return this.rhs.length == 0
    }

    lw.Rule.prototype.rhsAsText = function() {
	return this.rhs.map(function(sym){return sym.asText()}).join("");
    }

    lw.Rule.prototype.weight = function(letter,scope) {
	var weight = 1;
	if (letter.ruleActive(this) && this.hint.length > 0) {
	    var weightFunc = LetterWriter.ParamFunc.newFromString (this.hint);
	    if (typeof weightFunc != 'undefined') {
		weight = weightFunc.evaluate(scope);
		if (typeof(weight) == 'undefined' || weight < 0) weight = 0;
	    }
	}
	return weight;
    }

    lw.Rule.prototype.hasParam = function(param) {
	var weightFunc = LetterWriter.ParamFunc.newFromString (this.hint);
	return (typeof(weightFunc) != 'undefined' && weightFunc.hasParam(param))
    }

    lw.Rule.prototype.replaceParam = function(oldParam,newParam) {
	var weightFunc = LetterWriter.ParamFunc.newFromString (this.hint);
	if (typeof(weightFunc) != 'undefined' && weightFunc.hasParam(oldParam)) {
	    weightFunc.replace(oldParam,newParam)
	    this.hint = weightFunc.asText()
	}
	// TODO: replace Param in rhs ParamAssignment's, ParamReference's and ParamInput's
    }

    lw.Rule.prototype.expand = function (parentSpan, oldSpan, parentNode) {
	parentNode.leaf = false;
	parentNode.expansionRule = this;
	parentNode.cancelMoveListener()
	extend (parentNode.expansionParamValue = {}, parentNode.letter.paramValue);  // record Param settings, for later analytics interest
	parentNode.expansionDate = new Date(); // ditto timestamp

	var letter = parentNode.letter;
	var span = document.createElement("SPAN");  // this will be the parent of all expanded DOM nodes

	function makeHider(span) {
	    return function() {
		iterateDom(span,function(){
		    addClassToElement (this, "unselectable")
		    addClassToElement (this, "unrevealed")
		    removeClassFromElement (this, "reveal")
		    this.setAttribute ("style", "display:none")
		})
	    }
	}

	function makeFader(span) {
	    return function() {
		iterateDom(span,function(){
		    removeClassFromElement (this, "unselectable")
		    removeClassFromElement (this, "unrevealed")
		    addClassToElement (this, "reveal")
		    this.removeAttribute ("style")
		})
	    }
	}

	var rhsUnexpandedNodes = []
	var delayedExpansions = []
	parentNode.lastPauseNode = undefined;
	var sourceRule = this;
	for (var rhsPos = 0; rhsPos < this.rhs.length; ++rhsPos) {
	    var sym = this.rhs[rhsPos];
	    var symNode = parentNode.newChild (sym, span, sourceRule);  // creates LetterWriter.Node, attaches to parse tree; if nonrandom, creates controllers & attaches to DOM
	    function lastPauseNode() { return parentNode.lastPauseNode }
	    function currentlyPaused() { return typeof (lastPauseNode()) != "undefined" }
	    function pauseHere() { parentNode.lastPauseNode = symNode
//				   console.log("Paused at " + symNode.nodeIdentifier())
				 }
	    var preambleSpan = symNode.preambleSpan;
	    var symSpan = symNode.span;

	    if (sym instanceof lw.NontermReference && symNode.isLocallyControlledByComputer()) {
		symSpan.appendChild (symNode.placeholderSpan);
		var delayedExpand = (function(sym,symNode,symSpan) {
		    return function() {
//			console.log("delayedExpand of " + symNode.nodeIdentifier())
			var rule = sym.nonterminal.randomRule (letter, symNode.getScope());
			if (rule instanceof lw.Rule) {
			    rule.expand (symSpan, symNode.placeholderSpan, symNode)
			    symNode.publishWithStyle()
			}
		    }}) (sym, symNode, symSpan)
		if (currentlyPaused()) {
		    // delay hidden computer-played nodes until they become visible
		    // ...allowing us to embed game logic in the probabilistic weights for these rules
		    // hook into the notifyExpanded function, which must be called after undo is set up
		    lastPauseNode().notifyExpanded = chain (lastPauseNode().notifyExpanded, delayedExpand)
		} else {
//		    console.log("Pushing delayedExpand of " + symNode.nodeIdentifier())
		    delayedExpansions.push (delayedExpand)
		}
	    }

	    // player- or remotely-controlled symbol
	    var fader = chain (makeFader(symSpan), makeFader(preambleSpan))
	    var hider = chain (makeHider(symSpan), makeHider(preambleSpan));
	    hider();
	    span.appendChild (preambleSpan);
	    span.appendChild (symSpan);
	    if (currentlyPaused()) {
//		console.log("Not showing " + symNode.nodeIdentifier())
		lastPauseNode().notifyExpanded = chain (lastPauseNode().notifyExpanded, fader)
		lastPauseNode().notifyCollapsed = chain (lastPauseNode().notifyCollapsed, hider)
	    } else {
//		console.log("Showing " + symNode.nodeIdentifier())
		fader()
	    }
	    if (sym instanceof lw.NontermReference || sym instanceof lw.ParamInput) {
		if (sym.pause())
		    pauseHere()
		rhsUnexpandedNodes.push (symNode)
	    }
	}

	// replace the placeholder
	parentSpan.replaceChild (span, oldSpan);

	// set up undo (only accessible in single-player mode, so assume everything is local)
	if (parentNode.symbol.commit()) {
	    var gran = parentNode.parent
	    while (typeof(gran) != 'undefined') {
		for (var sib = 0; sib < parentNode.siblingIndex; ++sib) {
		    var sibNode = gran.child[sib]
		    iterateDom (sibNode.span,
				function() {
				    addClassToElement (this, 'hiddenByYoungerNode')
				})
		    sibNode.iteratePost (function(){
			if (!('hiddenBy' in this))
			    this.hiddenBy = parentNode
		    })
		}
		node = gran
		gran = node.parent
	    }
	    letter.resetUndo()
	} else {
	    function undoFunction() {
		parentSpan.replaceChild (oldSpan, span);
		parentNode.clear();
		letter.showParams();
		parentNode.notifyCollapsed();
		letter.updateEnabledOptions();
		letter.notifyChange()
	    }
	    if (parentNode.symbol.random()) {
		if (letter.history.length) {
		    letter.history[letter.history.length - 1]
			= chain (undoFunction, letter.history[letter.history.length - 1])
		}
	    } else {
		letter.history.push (undoFunction)
		letter.showUndo()
	    }
	}
	letter.updateEnabledOptions();

	// if no new unexpanded nodes have been produced, call parent's notifyExpanded() immediately
	// otherwise, postpone parent's notifyExpanded() until all child nodes have called us
	// this comes after undo, so any auto-expanded computer nodes can hook undo-handlers into the same "undo" link
	var rhsUnexpandedCount = rhsUnexpandedNodes.length;
	if (rhsUnexpandedCount == 0) {
//	    console.log(parentNode.nodeIdentifier() + "  has no nonterm descendants: calling notifyExpanded")
	    parentNode.notifyExpanded();
	} else {
	    parentNode.unexpandedChildren = rhsUnexpandedCount;
	    for (var i = 0; i < rhsUnexpandedNodes.length; ++i) {
		var symNode = rhsUnexpandedNodes[i];
		symNode.notifyExpanded
		    = chain (symNode.notifyExpanded,
			     (function(s,p){return function() {
//				 console.log(s.nodeIdentifier() + "  decrementing unexpandedChildren count of  " + p.nodeIdentifier() + "  (currently " + p.unexpandedChildren + ")")
				 if (--parentNode.unexpandedChildren == 0)
				     parentNode.notifyExpanded() }})(symNode,parentNode))

		symNode.notifyCollapsed
		    = chain (symNode.notifyCollapsed,
			     function() {
				 if (parentNode.unexpandedChildren++ == 0)
				     parentNode.notifyCollapsed() })
	    }
	}

	// play appropriate effects if letter finished
	if (letter.completed()) {
	    letter.hideParams();
	}

	letter.notifyChange()

	// do delayed expansions
	for (var i = 0; i < delayedExpansions.length; ++i)
	    (delayedExpansions[i]) ();
    }

    // Param
    lw.Param = function(p,v,min,max) {
	extend (this, {id: p.toLowerCase(),
		       name: p,
		       init: (v > 1 ? 1 : v),
		       min: min,
		       max: max})
    }

    lw.Param.prototype.asText = function() {
	return "$" + this.name + " {" + this.min + "=>" + this.max + "}" + " = " + this.init
    }

    // ParamFunc
    lw.ParamFunc = function(args) {
	this.op = undefined;
	extend (this, args);
	switch (this.op.toLowerCase()) {
	case "and": case "&&": this.op = "*"; break;
	case "vs": this.op = "/"; break;
	case "or": case "||": this.op = "+"; break;
	case "not": this.op = "!"; break;
	case "*":  // l*r   (multiplication of independent probabilities)
	case "/":  // l/r   (division, useful as a likelihood ratio or relative rate)
	case "+":  // l+r   (addition, l & r measure mutually exclusive events whose union we want)
	case "-":  // l-r   (subtraction, not really safe except when l=1)
	case "!":  // 1-l   (negation, represents everything except event l)
	case ".":  // l.r   (string concatenation)
	case "<":  // l<r
	case ">":  // l>r
	case "<=":  // l<=r
	case ">=":  // l>=r
	case "==":  // l==r
	case "!=":  // l!=r
	case "$":  // param (a parameter; can be a slider-controlled, locally-, or globally-scoped variable)
	case "$#":  // role-indexed parameter ($#score means $score1, $score2, $score3...depending on parent scope role)
	case "#":  // value (a numeric constant)
	case "'":  // value (a string constant)
	    break;
	default:
	    throw "Unknown operation " + this.op;
	    break;
	}
    }

    lw.ParamFunc.newFromString = function(str,isStringContext) {
	var weightFunc;
	try {
	    weightFunc = LetterWriter.parser.parse (str, "param_expr");
	} catch (e) {
	    console.log ("The following could not be parsed as a " + (isStringContext ? "string" : "weight") + ": " + str);
	}
	return weightFunc;
    }

    lw.ParamFunc.prototype.evaluate = function(scope) {
	var param;
	switch (this.op) {
	case "*": return this.l.evaluate(scope) * this.r.evaluate(scope);
	case "/": return this.l.evaluate(scope) / this.r.evaluate(scope);
	case "+": return this.l.evaluate(scope) + this.r.evaluate(scope);
	case "-": return this.l.evaluate(scope) - this.r.evaluate(scope);
	case ".": return String(this.l.evaluate(scope)) + String(this.r.evaluate(scope));
	case "!": return 1 - this.l.evaluate(scope);
	case "<": return (this.l.evaluate(scope) < this.r.evaluate(scope)) ? 1 : 0;
	case ">": return (this.l.evaluate(scope) > this.r.evaluate(scope)) ? 1 : 0;
	case "<=": return (this.l.evaluate(scope) <= this.r.evaluate(scope)) ? 1 : 0;
	case ">=": return (this.l.evaluate(scope) >= this.r.evaluate(scope)) ? 1 : 0;
	case "==": return (this.l.evaluate(scope) == this.r.evaluate(scope)) ? 1 : 0;
	case "!=": return (this.l.evaluate(scope) != this.r.evaluate(scope)) ? 1 : 0;
	case "$":
	case "$#":
	    param = scope.makeParamKey(this.op,this.param)
	    while (typeof(scope) != 'undefined') {
		if (param in scope.paramValue)
		    return scope.paramValue[param];
		else
		    scope = scope.parent;
	    }
	    return 0;
	case "#": return this.value;
	case "'": return this.value;
	}
    }

    lw.ParamFunc.prototype.asText = function() {
	switch (this.op) {
	case "*":
	case "/":
	case "+":
	case "-":
	case ".":
	case "<":
	case ">":
	case "<=":
	case ">=":
	case "==":
	case "!=":
	    return "(" + this.l.asText() + " " + this.op + " " + this.r.asText() + ")";
	case "!":
	    return "not " + this.l.asText();
	case "$":
	    return "$" + this.param;
	case "$#":
	    return "$" + this.param + "[$#]";
	case "#":
	    return this.value;
	case "'":
	    return '"' + this.value.replace('"','\\"') + '"';
	default:
	    break;
	}
	return undefined;
    }

    lw.ParamFunc.prototype.getParams = function() {
	var prefix, roleSuffix;
	switch (this.op) {
	case "*":
	case "/":
	case "+":
	case "-":
	case ".":
	case "<":
	case ">":
	case "<=":
	case ">=":
	case "==":
	case "!=":
	    return setUnion (this.l.getParams(), this.r.getParams());
	case "!":
	    return this.l.getParams();
	case "$":
	case "$#":
	    return [this.param.toLowerCase()];
	case "#":
	case "'":
	    return [];
	default:
	    break;
	}
	return undefined;
    }

    lw.ParamFunc.prototype.hasParam = function(id) {
	switch (this.op) {
	case "*":
	case "/":
	case "+":
	case "-":
	case ".":
	case "<":
	case ">":
	case "<=":
	case ">=":
	case "==":
	case "!=":
	    return this.l.hasParam(id) || this.r.hasParam(id);
	case "!":
	    return this.l.hasParam(id);
	case "$":
	case "$#":
	    return this.param.toLowerCase() == id.toLowerCase();
	case "#":
	case "'":
	    return false;
	default:
	    break;
	}
	return undefined;
    }

    lw.ParamFunc.prototype.replace = function(oldParam,newParam) {
	switch (this.op) {
	case "*":
	case "/":
	case "+":
	case "-":
	case ".":
	case "<":
	case ">":
	case "<=":
	case ">=":
	case "==":
	case "!=":
	    this.l.replace(oldParam,newParam);
	    this.r.replace(oldParam,newParam);
	    break;
	case "!":
	    this.l.replace(oldParam,newParam);
	    break;
	case "$":
	case "$#":
	    if (this.param.toLowerCase() == oldParam.toLowerCase())
		this.param = newParam;
	    break;
	case "#":
	case "'":
	default:
	    break;
	}
    }

    lw.ParamFunc.prototype.getBadParams = function(grammar) {
	var rhsParam = {}, sliderParam = {}
	for (var i = 0; i < grammar.params.length; ++i)
	    sliderParam[grammar.params[i].id] = true
	for (var i = 0; i < grammar.nonterms.length; ++i)
	    for (var j = 0; j < grammar.nonterms[i].rules.length; ++j)
		for (var k = 0; k < grammar.nonterms[i].rules[j].rhs.length; ++k)
		    if (grammar.nonterms[i].rules[j].rhs[k] instanceof LetterWriter.ParamAssignment)
			rhsParam[grammar.nonterms[i].rules[j].rhs[k].id] = true
	var params = this.getParams(), missing = [], unsafe = [];
	for (var i = 0; i < params.length; ++i)
	    if (!(params[i] in sliderParam))
		((params[i] in rhsParam) ? unsafe : missing).push (params[i]);
	return { missing: missing, unsafe: unsafe };
    }

    // Scope: a helper class for evaluating ParamFunc's
    lw.Scope = function(parent,role) { extend (this, { parent:parent, paramValue:{}, role: role }) }
    lw.Scope.prototype.clone = function() {
	var s = new lw.Scope()
	extend (s, this)
	extend (s.paramValue = {}, this.paramValue)
	return s
    }

    lw.Scope.prototype.makeParamKey = function(type,param) {
	var p = param;
	if (type == '$#')
	    p += "[" + (1 + this.role) + "]"
	return p
    }

    // Term
    lw.Term = function(text) {
	this.text = text
    }
    lw.Term.prototype.clone = function() { var term = new lw.Term(this.text); extend(term,this); return term }
    lw.Term.prototype.asText = function() { return this.text }

    // Nonterm
    lw.Nonterm = function(sym,prompt,anon) {
	extend (this, { id: sym,
			rules: [],
			anonymous: anon })
	if (typeof(prompt) != 'undefined')
	    this.prompt = this.defaultPrompt = prompt
    }
    lw.Nonterm.prototype.asText = function() { return "@" + this.id }
    lw.Nonterm.prototype.prompt = lw.Nonterm.prototype.defaultPrompt = "Select an option...";
    lw.Nonterm.prototype.placeholder = "...<br>";
    lw.Nonterm.prototype.preamble = "";
    lw.Nonterm.prototype.pause = false;
    lw.Nonterm.prototype.commit = false;
    lw.Nonterm.prototype.random = false;
    lw.Nonterm.prototype.role = "+";

    lw.Nonterm.prototype.clone = function(grammar) {
	var nonterm = new lw.Nonterm (grammar.createAnonId(this.id + "_copy"),
				      this.prompt,
				      this.anonymous)
	extend (nonterm, this, true)
	nonterm.rules = []
	for (var i = 0; i < this.rules.length; ++i)
	    nonterm.rules.push (this.rules[i].clone())
	return nonterm;
    }

    lw.Nonterm.prototype.addEmptyRule = function() { return this.addRule(undefined,[],{}) }
    lw.Nonterm.prototype.addRule = function(hint,rhs,mods) {
	var ruleIndex = this.rules.length
	this.rules.push(new lw.Rule(this.newRuleId(),hint,this,rhs,mods))
	var newRule = this.rules[ruleIndex]
	newRule.ruleIndex = ruleIndex
	return newRule
    }
    lw.Nonterm.prototype.newRuleId = function() { return this.id + "-" + (this.rules.length + 1) }
    lw.Nonterm.prototype.isHyperlink = function() { return this.rules.length == 1 && this.rules[0].hint == "" }

    lw.Nonterm.prototype.numberOfActiveRules = function(letter) {
	var n = 0
	for (var i = 0; i < this.rules.length; i++)
	    if (letter.ruleActive (this.rules[i]))
		++n
	return n
    }

    lw.Nonterm.prototype.hasActiveRules = function(letter) {
	for (var i = 0; i < this.rules.length; i++)
	    if (letter.ruleActive (this.rules[i]))
		return true;
	return false;
    }

    lw.Nonterm.prototype.hasParam = function(param) {
	if (this.random)
	    for (var i = 0; i < this.rules.length; i++)
		if (this.rules[i].hasParam(param))
		    return true;
	return false;
    }

    // bare: no text or RHS symbols
    lw.Nonterm.prototype.isBare = function() {
	// HACK/WORKAROUND: don't check the prompt here.
	// REASON: default prompt is currently computed from choice name by parser.
	// renaming the choice currently doesn't recompute the default prompt (logic is tucked away in parser),
	// so you get the ghost of the old choice name showing up in the prompt,
	// and this looks like the nonterminal has been edited, violating its "Bare" status.
	if (this.hasOwnProperty("preamble")
	    || this.hasOwnProperty("placeholder"))
	    return false;
	for (var i = 0; i < this.rules.length; i++)
	    if (!this.rules[i].isBare())
		return false;
	return true;
    }

    lw.Nonterm.prototype.looseEnds = function() {
	var n = 0
	for (var i = 0; i < this.rules.length; i++)
	    if (this.rules[i].isLooseEnd())
		++n
	return n
    }

    lw.Nonterm.prototype.isStart = function(grammar) {
	return this.id == lw.defaultStart() || this === grammar.start;
    }

    lw.Nonterm.prototype.isOrphan = function(grammar) {
	return !this.isStart(grammar) && this.incomingNonterms(grammar,true).length == 0
    }

    lw.Nonterm.prototype.incomingNonterms = function(grammar,excludeSelf) {
	var incoming = [];
	for (var i = 0; i < grammar.nonterms.length; ++i) {
	    var nonterm = grammar.nonterms[i];
	    var found = false;
	    if (nonterm != this || !excludeSelf)
		for (var j = 0; !found && j < nonterm.rules.length; ++j)
		    for (var k = 0; !found && k < nonterm.rules[j].rhs.length; ++k) {
			var sym = nonterm.rules[j].rhs[k];
			if (sym instanceof lw.NontermReference && sym.nonterminal === this) {
			    incoming.push(nonterm);
			    found = true;
			}
		    }
	}
	return incoming;
    }

    lw.Nonterm.prototype.outgoingNonterms = function(excludeSelf) {
	var outgoing = [], gotNonterm = {};
	for (var i = 0; i < this.rules.length; ++i) {
	    for (var j = 0; j < this.rules[i].rhs.length; ++j) {
		var sym = this.rules[i].rhs[j];
		if (sym instanceof lw.NontermReference) {
		    var rhsNonterm = sym.nonterminal
		    if ((rhsNonterm != this || !excludeSelf) && !(rhsNonterm.id in gotNonterm)) {
			outgoing.push(rhsNonterm);
			gotNonterm[rhsNonterm.id] = true
		    }
		}
	    }
	}
	return outgoing;
    }

    // Nonterm.attach
    // This method renders the HTML controllers
    var dummyName = 0;
    lw.Nonterm.prototype.attach = function (parentNode, parentSpan, placeholderSpan, prompt) {
	var letter = parentNode.letter;

	if (typeof prompt == 'undefined')
	    prompt = this.prompt;

	var span = document.createElement("SPAN");
	span.appendChild (placeholderSpan)

	if (this.hasActiveRules (letter)) {
	    if (this.isHyperlink()) {
		var link = document.createElement("A");
		parentNode.selectControl = link;
		var rule = this.rules[0];
		link.href = "#";
		link.innerHTML = prompt;
		link.onclick = function(e) {
		    e.preventDefault()
		    rule.expand (parentSpan, span, parentNode)
		    parentNode.publishWithStyle()
		};
		span.appendChild (link);

	    } else  {
		var formDiv = document.createElement("FORM");
		formDiv.setAttribute("action","#")
		formDiv.setAttribute("class","sceneMenu")
		parentNode.selectControl = formDiv
		var promptOption = document.createElement("SPAN");
		promptOption.innerHTML = prompt;
		span.appendChild (document.createElement("BR"))
		span.appendChild (promptOption)
		var activeRules = [], labels = []
		for (var i = 0; i < this.rules.length; ++i)
		    if (letter.ruleActive (this.rules[i])) {
			var rule = this.rules[i];
			var labelDiv = document.createElement("LABEL")
			var inputDiv = document.createElement("INPUT")
			inputDiv.setAttribute ("type", "radio")
			inputDiv.setAttribute ("name", "opt")
			inputDiv.setAttribute ("value", i+1)
			if (activeRules.length == 0)
			    inputDiv.setAttribute ("checked", "checked")
			var hintText = rule.hint.length ? rule.hint : rule.rhs.map(function(sym){return sym instanceof LetterWriter.Term ? sym.text : ""}).join(" ")
			var hintSpan = document.createElement("SPAN")
			hintSpan.innerHTML = hintText + "<br/>"
			labelDiv.appendChild (inputDiv)
			labelDiv.appendChild (hintSpan)
			formDiv.appendChild (labelDiv)
			parentNode.options.push (new lw.Option (rule, inputDiv));
			labels.push (labelDiv)
			activeRules.push (rule);
		    }

		if (labels.length) {
		    if (labels.length == 1)
			labels[0].setAttribute ("class", "onlyOption")
		    else {
			labels[0].setAttribute ("class", "firstOption")
			labels[labels.length - 1].setAttribute ("class", "lastOption")
		    }
		}

		var continueButton = document.createElement("BUTTON")
		continueButton.setAttribute ('type', 'button')
		continueButton.setAttribute ('class', 'continue')
		continueButton.innerHTML = "Continue" + ((letter.grammar.isSinglePlayer() || !letter.playingSolo()) ? "" : (" Player " + (1 + parentNode.role)))

		// the callback that expands the next rule when the player selects an option
//		select.onchange = function() {
//		    var i = select.selectedIndex
		continueButton.onclick = function() {
		    var rule
		    for (var j = 0; j < parentNode.options.length; j++) {
			var inputDiv = parentNode.options[j].element;
			if (inputDiv.checked) {
			    rule = parentNode.options[j].rule
			    break
			}
		    }

		    if (typeof(rule) != 'undefined') {
			rule.expand (parentSpan, span, parentNode)
			parentNode.publishWithStyle()
		    }
		}
//		span.appendChild (select);
		var formContainerDiv = document.createElement("DIV")
		formContainerDiv.setAttribute('class','sceneMenuContainer')
		formContainerDiv.appendChild(formDiv)
		span.appendChild (formContainerDiv)
		span.appendChild (continueButton)
	    }
	} else {
	    console.log ("@" + this.id + " has no active rules that can be chosen; using placeholder text");
	    span = placeholderSpan;
	}

	parentSpan.appendChild (span);
	return span;
    }

    lw.Nonterm.prototype.makeReference = function(props) {
	return new lw.NontermReference(this,props)
    }

    // Nonterm method to select a random rule
    lw.Nonterm.prototype.randomRule = function(letter,scope) {
	var total = 0;
	var weight = [];
	for (var i = 0; i < this.rules.length; ++i) {
	    var w = this.rules[i].weight(letter,scope);
	    weight.push(w);
	    total += w;
	}
	var r = Math.random() * total;
	for (var i = 0; i < this.rules.length; ++i)
	    if ((r -= weight[i]) <= 0)
		return this.rules[i];
	return undefined;
    }

    // NontermReference
    lw.NontermReference = function(nonterm,props) {
	var myProps = extend ({}, props);
	extend (this, { nonterminal: nonterm,
			props: myProps });

	this.buildAccessors();
    }

    lw.NontermReference.prototype.clone = function() {
	var ref = new lw.NontermReference (this.nonterminal, this.props)
	return ref
    }

    lw.NontermReference.prototype.buildAccessors = function() {
	var myProps = this.props;
	function propAccessor(name) { return function() { return (name in myProps) ? myProps[name] : this.nonterminal[name] } }
	extend (this, { preamble: propAccessor("preamble"),
			placeholder: propAccessor("placeholder"),
			prompt: propAccessor("prompt"),
			commit: propAccessor("commit"),
			pause: propAccessor("pause"),
			random: propAccessor("random") })

	this.asText = function() {
	    return makePreamblePlaceholderPrompt(myProps)
		+ this.nonterminal.asText()
		+ (("pause" in myProps) && myProps.pause ? ";" : "")
		+ (("commit" in myProps) && myProps.commit ? "!" : "")
		+ (("random" in myProps) && myProps.random ? "?" : "")
	}
    }

    lw.NontermReference.prototype.sanitizeQualifiers = function() {
	if (this.random()) {
	    if (this.commit()) {
		console.log ("Can't commit at randomized choice (@" + this.nonterminal.id + "). Ignoring '!' modifier")
		delete this.props.commit
	    }
	}
	this.buildAccessors();
	return this;  // allow chaining/returning
    }

    // ParamReference
    lw.ParamReference = function(type,id) { this.type = type; this.id = id }
    lw.ParamReference.prototype.clone = function() { var p = new lw.ParamReference(this.id); extend(p,this); return p }
    lw.ParamReference.prototype.asText = function() {
	return "$" + this.id + ";"
    }

    lw.ParamReference.prototype.evaluate = function(scope) {
	var param = scope.makeParamKey (this.type, this.id)
	while (typeof(scope.parent) != 'undefined' && !(this.id in scope.paramValue))
	    scope = scope.parent;
	return (param in scope.paramValue) ? scope.paramValue[param] : undefined;
    }


    // ParamAssignment
    lw.ParamAssignment = function(args) { extend (this, args) }
    lw.ParamAssignment.prototype.clone = function() { return new lw.ParamAssignment(this) }
    lw.ParamAssignment.prototype.asText = function() {
	var lhsAsText = '$' + this.id
	if (this.type == '$#')
	    lhsAsText += '[$#]'
	// use shorthand for cumulative ops
	if (!this.local) {
	    var op = this.value.op
	    if ((op == '+' || op == '-' || op == '/' || op == '*')
		&& this.value.l.asText() == lhsAsText) {
		if ((op == '+' || op == '-') && this.value.r.asText() == '1')
		    return lhsAsText + op + op + ';';
		return lhsAsText + " " + op + "= " + this.value.r.asText() + ';'
	    }
	}
	// generic return
	return lhsAsText + " " + (this.local ? "@=" : "=") + " " + this.value.asText() + ";"
    }

    lw.ParamAssignment.prototype.makeParamKey = function(scope) {
	return scope.makeParamKey (this.type, this.id)
    }

    lw.ParamAssignment.prototype.updateScope = function(scope) {
	var param = this.makeParamKey (scope)
	var paramScope = scope
	if (!this.local)
	    while (typeof(paramScope.parent) != 'undefined' && !(param in paramScope.paramValue))
		paramScope = paramScope.parent;
	paramScope.paramValue[param] = this.value.evaluate(scope)
    }

    // ParamInput
    lw.ParamInput = function(args) { extend (this, args) }
    lw.ParamInput.prototype.clone = function() { return new lw.ParamInput(this) }
    lw.ParamInput.prototype.asText = function() {
	var lhsAsText = '$' + this.id
	if (this.type == '$#')
	    lhsAsText += '[$#]'
	return lhsAsText + "=?" + (this.pause() ? ";" : "")
    }
    lw.ParamInput.prototype.pause = function() { return ("pause" in this.mods) ? this.mods.pause : false }

    lw.ParamInput.prototype.evaluate = lw.ParamReference.prototype.evaluate

    // Letter
    var undoRechargeTicks = 100;  // undo recharge will be split over this many callbacks for smooth animation
    var undoRechargeTimeMultiplierPercent = 5;  // 5% increase in recharge time each time player uses Undo
    var undoRechargeTimeMultiplier = 1 + (undoRechargeTimeMultiplierPercent / 100)
    var initialUndoRechargeTime = 5000;  // the initial value, resets after a commit
    lw.Letter = function(grammar,args,parentIdPrefix) {
	var letter = this;

	// handle missing args
	if (typeof args == 'undefined')
	    args = {};
	var myArgs = { undoId: (("id" in args) ? args.id : "undo"),
		       id: "letter",
		       reveal: "reveal",  // id of DIV to reveal when game completes (TODO: more than one such DIV?)
		       editor: undefined,
		       letterProperties: {} };
	extend (myArgs, args);
	args = myArgs;

	// identify key DOM nodes
	if (!document.getElementById (args.undoId))
	    args.undoId = args.id;
	var parent = document.getElementById (args.id);

	// set defaults
	extend (this, { grammar: grammar,
			parent: parent,
			history: [],
			nodeCount: 0,  // used to give each node a unique ID
			undoRechargeTime: ("wait" in grammar.undo) ? grammar.undo.wait : initialUndoRechargeTime,
			undoCharge: undoRechargeTicks,
			paramValue: {},
			notifyChangeInner: function(){},
			notifyChange: function() { letter.notifyChangeInner() } })
	extend (this, myArgs.letterProperties)

	for (var i = 0; i < grammar.params.length; ++i)
	    this.paramValue[grammar.params[i].id] = grammar.params[i].init;

	// set up final reveal
	if ("reveal" in args) {
	    var revealDiv = document.getElementById (args.reveal);
	    if (typeof revealDiv != 'undefined')
		this.revealDiv = revealDiv;
	}

	// set up undo button
	var undoDiv = document.createElement("DIV");
 	undoDiv.setAttribute ("class", "letter undo topLinkButton");

	var undoHtml = "<small><i>undo</i></small>";

	var undoLink = document.createElement("A");
	undoLink.href = "#";
	undoLink.innerHTML = undoHtml;

	var undoDummyLink = document.createElement("SPAN");
	undoDummyLink.setAttribute ("style", "display: none");
	undoDummyLink.innerHTML = undoHtml;

	var meterDiv = document.createElement("DIV");
 	meterDiv.setAttribute ("class", "letter undoMeter");

	var meterSpan = document.createElement("SPAN");
	meterDiv.appendChild (meterSpan);

	var spacerDiv = document.createElement("DIV");
 	spacerDiv.setAttribute ("class", "letter undoSpacer");

	var undo = function(e) {
	    e && e.preventDefault();
	    if (letter.undoCharge >= undoRechargeTicks && letter.history.length) {
		letter.undo();
		if (letter.undoRechargeTime > 0) {
		    if (letter.history.length == 0)
			letter.hideUndo();
		    letter.undoCharge = 0;
		    letter.undoRechargeTime *= undoRechargeTimeMultiplier;
		    letter.undoRechargeTimer = window.setInterval (function() {
			if (++letter.undoCharge >= undoRechargeTicks) {
			    window.clearInterval (letter.undoRechargeTimer);
			    hideElement (undoDummyLink);
			    showElement (undoLink);
			}
			meterSpan.setAttribute ("style", "width: " + Math.floor (100 * letter.undoCharge / undoRechargeTicks) + "%");
		    }, letter.undoRechargeTime / undoRechargeTicks);
		    hideElement (undoLink);
		    showElement (undoDummyLink);
		}
	    };
	};
	undoDiv.onclick = undo;

	this.undoDiv = undoDiv;
	this.hideUndo();

	undoDiv.appendChild (undoLink);
	undoDiv.appendChild (undoDummyLink);
	undoDiv.appendChild (spacerDiv);
	if (letter.undoRechargeTime > 0)
	    undoDiv.appendChild (meterDiv);

	var undoParent = document.getElementById (args.undoId);
	undoParent.appendChild (undoDiv);
	this.undoParent = undoParent;

	// set up the sliders
	this.paramsDiv = $("#slidersContainer");
	this.paramsDiv.empty()
	if (grammar.params.length) {
	    this.paramsDiv.append('<div class="slidersBackground" id="sliders"/>');
	    for (var i = 0; i < grammar.params.length; ++i) {
		var param = grammar.params[i];
		var min = param.min;
		var max = param.max;
		var value = param.init;
		var letter = this;
		var sliderDiv = $("<div></div>")
		    .addClass("slider")
		    .slider({ min: 0,
			      max: 1,
			      value: value,
			      step: .01,
			      change: function(event,ui) {
				  letter.paramValue[param.id] = ui.value;
			      }})
		    .prepend('<span class="slidermin sliderlabel">'+min+ '</span>')
		    .append('<span class="slidermax sliderlabel">'+max+ '</span>');

		var paramDiv = $("<div></div>")
		    .addClass("sliderparam")
		    .append('<span>' + param.name + '</span>');

		var parentDiv = $("<div></div>")
		    .addClass("sliderparent")
		    .append(paramDiv)
		    .append(sliderDiv)

		$("#sliders").append (parentDiv);
	    }
	}
	this.showParams();

	// score update animation
	var scoreTickInterval = 1000, deltaFloatInterval = 20
	var scoreContainerDiv = document.getElementById('scoreContainer')
	if (grammar.hasScoreParam() && typeof(scoreContainerDiv) != 'undefined') {
	    var scoreParams = []
	    if (grammar.scoreParamType == '$#')
		for (var r = 1; r <= grammar.roles; ++r)
		    scoreParams.push (grammar.scoreParam + r)
	    else
		scoreParams.push (grammar.scoreParam)

	    scoreContainerDiv.innerHTML = ''
	    var tableDiv = document.createElement('table')
	    tableDiv.setAttribute('class','scoreTable')
	    var trDiv = document.createElement('tr')
	    trDiv.setAttribute('style','width:'+(100/scoreParams.length)+'%')
	    tableDiv.appendChild(trDiv)
	    scoreContainerDiv.appendChild(tableDiv)

	    var scoreDivs = [], scoreLabelDivs = [], tdDivs = []
	    for (var r = 0; r < scoreParams.length; ++r) {
		tdDivs[r] = document.createElement('td')
		tdDivs[r].setAttribute('align',
				       (scoreParams.length == 1 || (r > 0 && r < scoreParams.length - 1))
				       ? 'center'
				       : (r == 0 ? 'left' : 'right'))
		scoreLabelDivs[r] = document.createElement('span')
		scoreDivs[r] = document.createElement('span')
		var parentDiv = tdDivs[r]
		if (scoreParams.length > 1 && ('playerRole' in letter) && r == letter.playerRole) {
		    parentDiv = document.createElement('b')
		    tdDivs[r].appendChild(parentDiv)
		}
		parentDiv.appendChild(scoreLabelDivs[r])
		parentDiv.appendChild(scoreDivs[r])
		trDiv.appendChild(tdDivs[r])
	    }

	    var scoreParamFunc = new lw.ParamFunc ({ op: grammar.scoreParamType, param: grammar.scoreParam })
	    this.getScore = function(role) {
		var scope = letter.root.getFinalScope();
		scope.role = role;
		return scoreParamFunc.evaluate(scope) }
	    this.addNotify (function(){
		function sign(x) { return x ? x < 0 ? -1 : 1 : 0; }
		var originalDelta = scoreParams.map(function(x){return undefined})
		var updateScore = function() {
		    delete letter.scoreTimer

		    for (var r = 0; r < scoreParams.length; ++r) {
			var scoreDiv = scoreDivs[r]
			var scoreLabelDiv = scoreLabelDivs[r]
			var tdDiv = tdDivs[r]

			var result = ""
			var label = ""
			var score = letter.getScore(r)
			var scoreDefined = typeof(score) != 'undefined'
			var sgn = 0
			if (scoreDefined) {
			    label = ((grammar.isSinglePlayer() || grammar.scoreParamType == '$')
				     ? "Score"
				     : (('playerIDs' in letter)
					? letter.playerIDs[r]
					: ("Player " + (r+1)))) + ": "
			    var oldScore = parseInt (scoreDiv.innerHTML) || 0
			    var newScore = score
			    if (score != oldScore) {
				var delta = score - oldScore
				if (typeof(originalDelta[r]) == 'undefined')
				    originalDelta[r] = delta
				sgn = sign(delta)
				var step = sgn * Math.max (1, Math.round (Math.abs(delta) / 2))
				newScore = oldScore + step
				if (sgn != 0)
				    letter.scoreTimer = window.setTimeout (updateScore, 100)
			    } else if (typeof(originalDelta[r]) != 'undefined') {
				var deltaSpan = document.createElement("span")
				deltaSpan.setAttribute("class",originalDelta[r] > 0 ? "scoreDeltaPositive" : "scoreDeltaNegative")

				var deltaSpanStyleHack = ""
				if ($("#showIDECheckbox")[0].checked)  // cheating because i don't understand CSS
				    deltaSpan.setAttribute ("style", deltaSpanStyleHack = "position:relative;")

				deltaSpan.innerHTML = (originalDelta[r] > 0 ? "+" : "-") + Math.abs(originalDelta[r]).toString()
				var deltaSpanPos = -5, deltaSpanOpacity = 1
				function setPos() { deltaSpan.setAttribute("style",deltaSpanStyleHack+"top:"+deltaSpanPos+";opacity:"+deltaSpanOpacity) }
				setPos()
				tdDiv.appendChild(deltaSpan)
				var dummy = (function(tdDiv,deltaSpan,setPos) {
				    var maxTicks = 80, ticks = maxTicks
				    var deltaTimer
				    function deltaFloat() {
					if (--ticks <= 0) {
					    clearInterval(deltaTimer)
					    deltaTimer = undefined
					    tdDiv.removeChild (deltaSpan)
					} else {
					    --deltaSpanPos
					    deltaSpanOpacity = ticks / maxTicks
					    setPos()
					}
				    }
				    deltaTimer = window.setInterval (deltaFloat, deltaFloatInterval)
				}) (tdDiv, deltaSpan, setPos)
			    }
			    result = newScore.toString()
			}
			removeClassFromElement(scoreContainerDiv,"scoreContainerHidden")
			removeClassFromElement(scoreContainerDiv,"scoreContainerIncreasing")
			removeClassFromElement(scoreContainerDiv,"scoreContainerDecreasing")
			if (sgn != 0)
			    addClassToElement(scoreContainerDiv,sgn > 0 ? "scoreContainerIncreasing" : "scoreContainerDecreasing")
			scoreDiv.innerHTML = result
			scoreLabelDiv.innerHTML = label
		    }
		}
		if ("scoreTimer" in letter)
		    clearTimeout (letter.scoreTimer)
		updateScore()
	    })
	}

	// OK, ready to go
	this.root = new LetterWriter.Node (this, new LetterWriter.NontermReference (grammar.start, {}), undefined, undefined);
	parent.innerHTML = "";  // clear any loading animation
	parent.appendChild(this.root.preambleSpan);
	parent.appendChild(this.root.span);

	// set up debug parse tree view
	if (typeof parentIdPrefix == 'undefined' || parentIdPrefix == "")
	    parentIdPrefix = "editor";
	var parseDiv = $("#"+parentIdPrefix+"ParseTree");

	function showDebugParseTree() { letter.debugParseTree = new lw.DebugParseTreeView (letter, parseDiv[0]) }
	if (parseDiv.length) {
	    this.addNotify(showDebugParseTree)
	    showDebugParseTree()
	}
	letter.showDebugParseTree = showDebugParseTree

	// publish and listen
	this.root.publishWithStyle()
	if (this.root.isLocallyControlled())
	    this.root.addMoveListener(false)  // leave a listener at the root, to rebroadcast moves to late joiners
    }

    lw.Letter.prototype.setTitle = function() {
	document.title = this.grammar.title;
    }

    lw.Letter.prototype.resetUndo = function() {
	this.history = [];
	this.hideUndo();
	this.undoRechargeTime = initialUndoRechargeTime;  // you've been a good Player
    }

    lw.Letter.prototype.attachEditor = function(editor) { this.editor = editor }
    lw.Letter.prototype.detachEditor = function(editor) { this.editor = null }
    
    lw.Letter.prototype.addNotify = function(f) { this.notifyChangeInner = chain (this.notifyChangeInner, f) }

    lw.Letter.prototype.ruleActive = function(rule) {
	if (("maxUsage" in rule) && this.ruleUsage(rule.id) >= rule.maxUsage)
	    return false;
	if (("timesHidden" in rule) && this.nontermUsage(rule.lhs.id) <= rule.timesHidden)
	    return false;
	var ruleNontermUsage = {};
	for (var i = 0; i < rule.rhs.length; ++i) {
	    var sym = rule.rhs[i];
	    if (sym instanceof LetterWriter.NontermReference) {
		var nonterm = sym.nonterminal;
		if (!(nonterm.id in ruleNontermUsage))
		    ruleNontermUsage[nonterm.id] = 0;
		++ruleNontermUsage[nonterm.id];
	    }
	}
	for (var id in ruleNontermUsage) {
	    var nonterm = this.grammar.nonterm[id];
	    if (("maxUsage" in nonterm) && this.nontermUsage(id) + ruleNontermUsage[id] > nonterm.maxUsage)
		return false;
	}
	return true;
    }

    lw.Letter.prototype.nontermUsage = function(id) {
	var n = 0;
	if ("root" in this)
	    this.root.iteratePost (function(){
		if (this.symbol instanceof LetterWriter.NontermReference && (this.symbol.nonterminal.id == id || typeof(id) == 'undefined'))
		    ++n;
	    });
	return n;
    }

    lw.Letter.prototype.termNodes = function() {
	var n = 0;
	this.root.iteratePost (function(){
	    if (this.symbol instanceof LetterWriter.Term)
		++n;
	});
	return n;
    }

    lw.Letter.prototype.ruleUsage = function(id) {
	var n = 0;
	this.root.iteratePost (function(){
	    if (typeof(this.sourceRule) != 'undefined' && this.sourceRule.id == id)
		++n;
	});
	return n;
    }

    lw.Letter.prototype.completed = function() {
	var letter = this;
	var leaves = 0;
	this.root.iteratePost (function(){
	    if (this.symbol instanceof LetterWriter.NontermReference && this.symbol.nonterminal.hasActiveRules(letter) && this.leaf)
		++leaves;
	});
	return leaves == 0;
    }

    lw.Letter.prototype.playingSolo = function() {
	return this.grammar.isSinglePlayer() || !('playerRole' in this)
    }

    lw.Letter.prototype.undo = function() {
	if (this.history.length)
	    (this.history.pop())();
    }

    lw.Letter.prototype.hideUndo = function() { hideElement(this.undoDiv) }
    lw.Letter.prototype.showUndo = function() {
	if (this.playingSolo())
	    showElement(this.undoDiv)
    }

    lw.Letter.prototype.hideParams = function() { hideElement(this.paramsDiv[0]) }
    lw.Letter.prototype.showParams = function() {
	if (this.grammar.params.length)
	    showElement(this.paramsDiv[0]) }

    lw.Letter.prototype.clear = function() {
	this.parent.innerHTML = "";
	this.undoParent.innerHTML = "";
	this.paramsDiv[0].innerHTML = "";

	var scoreContainerDiv = document.getElementById('scoreContainer')
	if (typeof(scoreContainerDiv) != 'undefined')
	    addClassToElement (scoreContainerDiv, "scoreContainerHidden")
	scoreContainerDiv.innerHTML = ""
    }

    lw.Letter.prototype.updateEnabledOptions = function() {
	this.root.iteratePost (this.root.updateEnabledOptions);
    }

    // Node: a node in the Letter parse tree
    // Has pointers back to the DOM
    lw.Node = function(letter,symbol,parentNode,parentSpan,sourceRule) {
	var node = this;
	extend (this, { letter: letter,
			count: ++letter.nodeCount,
			parent: parentNode,
			siblingIndex: undefined,
			role: (typeof(parentNode) == 'undefined' ? undefined : parentNode.role),
			symbol: symbol,
			sourceRule: sourceRule,
			expansionRule: undefined,
			creationParamValue: {},
			preambleSpan: document.createElement("SPAN"),
			placeholderSpan: document.createElement("SPAN"),
			span: document.createElement("SPAN"),
			parentSpan: parentSpan,
			options: [],
			child: [],
			leaf: true })

	if (parentNode instanceof LetterWriter.Node) {
	    this.siblingIndex = parentNode.child.length
	    parentNode.child.push (this)
	    extend (this.creationParamValue, parentNode.expansionParamValue)
	}

	if (symbol instanceof LetterWriter.Term)
	    this.span.innerHTML = this.terminalTextToHtml(symbol.text);
	else if (symbol instanceof LetterWriter.NontermReference) {
	    this.preambleSpan.innerHTML = this.terminalTextToHtml(symbol.preamble());
	    this.placeholderSpan.innerHTML = this.terminalTextToHtml(symbol.placeholder());

	    if (parentNode instanceof LetterWriter.Node) {
		var symbolRole = symbol.nonterminal.role, totalRoles = letter.grammar.roles, parentRole = parentNode.role
		switch (symbolRole) {
		case "+": this.role = (parentRole + 1) % totalRoles; break;
		case "-": this.role = (parentRole + totalRoles - 1) % totalRoles; break;
		case "=": this.role = parentRole; break;
		default: this.role = parseInt(symbolRole) - 1; break;
		}
	    } else
		this.role = 0  // role #0 always owns root node

	    if (this.isLocallyControlledByHuman())
		this.symbol.nonterminal.attach (this, this.span, this.placeholderSpan, symbol.prompt());
	    else if (this.isRemotelyControlled())
		this.attachWithListener()

	} else if (symbol instanceof LetterWriter.ParamAssignment) {
	    // empty span is fine
	} else if (symbol instanceof LetterWriter.ParamInput) {
	    node.setInputValue = function(value) {
		node.symbol = new lw.ParamAssignment ({ type: symbol.type,
							id: symbol.id,
							value: new lw.ParamFunc ({ op: "'",
										   value: value }) })
		node.inputValue = value
		node.span.innerText = value
		node.notifyExpanded()
		letter.notifyChange()
	    }
	    if (node.isLocallyControlled()) {
		var formDiv = document.createElement('form')
		var inputDiv = document.createElement('input')
		var okLink = document.createElement('a')
		inputDiv.setAttribute('type','text')
		inputDiv.value = symbol.evaluate(this.getScope())
		inputDiv.setAttribute ("autofocus", "autofocus");
		inputDiv.onkeypress = function (e) {
		    if (e.keyCode == 13)
			okLink.click();
		};
		okLink.setAttribute('href','#')
		okLink.innerText = "OK"
		okLink.onclick = function(e) {
		    e.preventDefault()
		    letter.resetUndo()  // inputs always commit... quick hack to prevent headaches
		    node.span.removeChild (node.placeholderSpan)
		    node.setInputValue (inputDiv.value)
		    node.publishWithStyle()
		}
		formDiv.appendChild (inputDiv)
		this.placeholderSpan.appendChild (formDiv)
		this.placeholderSpan.appendChild (okLink)
		this.span.appendChild (this.placeholderSpan)

	    } else
		this.attachWithListener()

	} else if (symbol instanceof LetterWriter.ParamReference) {
	    var value = symbol.evaluate (this.getScope())
	    if (typeof value == 'undefined')
		this.span.innerHTML = '<span class="undefinedParameter">' + symbol.id + '</span>'
	    else
		this.span.innerHTML = this.terminalTextToHtml(value.toString())
	} else
	    throw "Unknown symbol type encountered during rule expansion";
    }

    lw.Node.prototype.isNonterminal = function() {
	return this.symbol instanceof lw.NontermReference;
    }

    lw.Node.prototype.isLocallyControlled = function() {
	return this.letter.playingSolo() ? true : (this.letter.playerRole == this.role);
    }

    lw.Node.prototype.isLocallyControlledByComputer = function() {
	return this.isLocallyControlled() && this.isNonterminal() && this.symbol.random();
    }

    lw.Node.prototype.isLocallyControlledByHuman = function() {
	return this.isLocallyControlled() && !this.isLocallyControlledByComputer();
    }

    lw.Node.prototype.isRemotelyControlled = function() {
	return !this.isLocallyControlled();
    }

    lw.Node.prototype.attachWithListener = function() {
	var node = this
	var promise = node.addMoveListener(false)
	if (typeof(promise) != 'undefined') {
	    node.placeholderSpan.className = 'moveListenerConnecting'
	    promise.then(function(){ node.placeholderSpan.className = 'moveListener' })
	}
	node.span.appendChild (node.placeholderSpan);
    }

    lw.Node.prototype.terminalTextToHtml = function(text) {
	return text.replace(/\n/g,"<br>").replace(/_([^_]+)_/g,"<i>$1</i>").replace(/\*([^\*]+)\*/g,"<b>$1</b>")
    }

    lw.Node.prototype.newChild = function(symbol,parentSpan,sourceRule) {
	var node = new lw.Node(this.letter, symbol, this, parentSpan, sourceRule);
	return node;
    }
    lw.Node.prototype.clear = function() { this.child = []; this.leaf = true }
    lw.Node.prototype.notifyExpanded = function() {
//	console.log ("Node expanded: " + this.nodeIdentifier());
    }
    lw.Node.prototype.notifyCollapsed = function() {
//	console.log ("Node collapsed: " + this.nodeIdentifier());
    }

    lw.Node.prototype.showPlaceholder = function() {
	if (this.span.parentNode == this.parentSpan)
	    this.parentSpan.replaceChild (this.placeholderSpan, this.span);
    }

    lw.Node.prototype.hidePlaceholder = function() {
	if (this.placeholderSpan.parentNode == this.parentSpan)
	    this.parentSpan.replaceChild (this.span, this.placeholderSpan);
    }

    lw.Node.prototype.updateEnabledOptions = function() {
	if (this.leaf) {
	    var letter = this.letter;
	    var enabledNow = 0, enabledBefore = 0;
	    for (var i = 0; i < this.options.length; ++i) {
		if (!this.options[i].element.disabled) ++enabledBefore;
		var active = letter.ruleActive (this.options[i].rule);
		if (active) ++enabledNow;
		this.options[i].element.disabled = !active;
	    }
	    if (enabledNow == 0 && enabledBefore > 0) {
		this.showPlaceholder();
//		console.log("Newly-enabled option expanded at " + this.nodeIdentifier())
		this.notifyExpanded();
	    } else if (enabledNow > 0 && enabledBefore == 0) {
		this.hidePlaceholder();
		this.notifyCollapsed();
	    }
	}
    }

    lw.Node.prototype.iteratePost = function(f,last) {
	for (var i = 0; i < this.child.length; ++i)
	    if (this.child[i].iteratePost(f,last))
		return true;
	f.apply (this);
	return this === last;
    }

    lw.Node.prototype.iteratePre = function(f,last) {
	f.apply (this);
	if (this === last)
	    return true;
	for (var i = 0; i < this.child.length; ++i)
	    if (this.child[i].iteratePre(f,last))
		return true;
	return false;
    }

    lw.Node.prototype.iterateAncestorsPost = function(f,last,child) {
	f.apply(this,[child]);
	if (this === last)
	    return;
	if (typeof(this.parent) != 'undefined')
	    this.parent.iterateAncestorsPost(f,last,this)
    }

    lw.Node.prototype.iterateAncestorsPre = function(f,last,child) {
	if (typeof(this.parent) != 'undefined')
	    if (this.parent.iterateAncestorsPre(f,last,this))
		return true;
	f.apply(this,[child]);
	if (this === last)
	    return true;
    }

    lw.Node.prototype.iterateChild = function(f,last) {
	for (var i = 0; i < this.child.length; ++i) {
	    f.apply (this.child[i]);
	    if (this.child[i] === last)
		break;
	}
    }

    lw.Node.prototype.iterateNontermChild = function(f) {
	this.iterateChild (function(){
	    if (this.symbol instanceof lw.NontermReference)
		f.apply(this) })
    }

    lw.Node.prototype.nontermChildren = function() {
	var nc = []
	this.iterateNontermChild (function(c){nc.push(c)})
	return nc
    }

    lw.Node.prototype.getScopeInner = function(includingSelf) {
	var node = this
	var finalScope
	function updateScope(node,last,scope) {
	    if (node === last)
		finalScope = scope
	    else if (node.symbol instanceof lw.NontermReference) {
		var inner = new lw.Scope (scope, node.role)
		inner.role = node.role
		node.iterateChild (function() { updateScope(this,last,inner) }, last)
	    } else if (node.symbol instanceof lw.ParamAssignment)
		node.symbol.updateScope(scope)
	}
	updateScope (node.letter.root, includingSelf ? undefined : this, finalScope = new lw.Scope(undefined,node.letter.root.role))
	finalScope.role = this.role
	return finalScope
    }

    lw.Node.prototype.getScope = function(includingSelf) {
	var sliderScope = this.getScopeInner(includingSelf).clone()
	extend (sliderScope.paramValue, letter.paramValue)
	return sliderScope;
    }

    lw.Node.prototype.getLastDescendant = function() {
	return this.child.length ? this.child[this.child.length-1] : this
    }

    lw.Node.prototype.getFinalScope = function() {
	var finalScope = this.getScope(true).clone()
	extend (finalScope.paramValue, letter.paramValue)  // allow slider params to override final ParamAssignment
	finalScope.role = this.role
	return finalScope
    }

    lw.Node.prototype.nodeChannel = function() {
	return this.letter.gameMessage.playChannelPrefix() + this.nodeIdentifier()
    }

    lw.Node.prototype.allDescendantNodeChannels = function() {
	return this.nodeChannel() + '/**'
    }

    lw.Node.prototype.nodeIdentifier = function() {
	var suffices = []
	var node = this
	while (true) {
	    suffices.unshift ((node.symbol instanceof lw.NontermReference)
			      ? node.symbol.nonterminal.id
			      : (((node.symbol instanceof lw.ParamInput)
				  || ((node.symbol instanceof lw.ParamAssignment) && ("inputValue" in node)))
				 ? '-input'
				 : ('-node-' + node.count)))
	    if (typeof(node.parent) == 'undefined')
		break;
	    suffices.unshift ('s' + (1 + node.siblingIndex))
	    suffices.unshift ('r' + (1 + node.sourceRule.ruleIndex))
	    node = node.parent
	}
	return suffices.map(function(s){return'/'+s}).join('');
    }

    lw.Node.prototype.treeJSON = function() {
	var msgNode = null;
	if (this.symbol instanceof lw.NontermReference) {
	    msgNode = { name: this.symbol.nonterminal.id,
			type: "nonterm" }
	    if (typeof(this.expansionRule) != 'undefined') {
		msgNode.rule = this.expansionRule.ruleIndex
		msgNode.child = this.child.map (function(c) { return c.treeJSON() })
	    }
	} else if ((this.symbol instanceof lw.ParamAssignment) && ("inputValue" in this))
	    msgNode = { type: "input",
			value: this.inputValue }

	return msgNode
    }

    lw.Node.prototype.expandFromTreeJSON = function(msgNode) {
	var msgNodeExpanded = ('rule' in msgNode);
	var nodeExpanded = (typeof(this.expansionRule) != 'undefined')
	if (msgNodeExpanded) {
	    if (nodeExpanded) {
		if (this.expansionRule.ruleIndex != msgNode.rule) {
		    console.log("Received tree conflicts with parse tree: rule indices don't match")
		    console.log(msgNode)
		    console.log(this)
		    return
		}
	    } else
	    	this.symbol.nonterminal.rules[msgNode.rule].expand (this.span, this.placeholderSpan, this);

	    if (this.child.length != msgNode.child.length) {
		console.log("Received tree conflicts with parse tree: child counts don't match")
		console.log(msgNode)
		console.log(this)
		return
	    }

	    for (var sib = 0; sib < this.child.length; ++sib) {
		var childNode = this.child[sib], childMsgNode = msgNode.child[sib]
		var childNodeIsNonterm = (childNode.symbol instanceof lw.NontermReference)
		var childNodeIsInput = (childNode.symbol instanceof lw.ParamInput)
		var childMsgNodeIsNonterm = (childMsgNode != null && childMsgNode.type == "nonterm")
		var childMsgNodeIsInput = (childMsgNode != null && childMsgNode.type == "input")
		if (childNodeIsNonterm != childMsgNodeIsNonterm) {
		    console.log("Received tree conflicts with parse tree: node types don't match")
		    console.log(msgNode)
		    console.log(this)
		    return
		}
		if (childNodeIsNonterm)
		    childNode.expandFromTreeJSON (childMsgNode)
		else if (childNodeIsInput && childMsgNodeIsInput)
		    childNode.setInputValue (childMsgNode.value)
	    }
	} else  // !msgNodeExpanded
	    if (nodeExpanded)
		this.publish()  // another player is missing our expansion of this node, so republish it
    }

    lw.Node.prototype.addMoveListener = function(listenForDescendants) {
	var promise
	if ("client" in this.letter) {
	    var letter = this.letter
	    function moveHandler(msg) {
		letter.root.expandFromTreeJSON (msg.tree)
	    }
	    var id = this.nodeIdentifier()
	    promise = letter.addMoveListener (id, this.nodeChannel(), moveHandler)
	    if (listenForDescendants)
		letter.addMoveListener (id + '*', this.allDescendantNodeChannels(), moveHandler)
	}
	return promise
    }

    lw.Node.prototype.cancelMoveListener = function() {
	if (this.isRemotelyControlled()) {
	    var id = this.nodeIdentifier()
	    this.letter.cancelMoveListener (id)
	    this.letter.cancelMoveListener (id + '*')
	}
    }

    lw.Node.prototype.publish = function() {
	var promise
	if ("client" in this.letter) {
	    var msg = this.letter.gameMessage.clone()
	    msg.tree = this.letter.root.treeJSON()
	    promise = this.letter.client.publish(this.nodeChannel(), msg)
	}
	return promise
    }

    lw.Node.prototype.publishWithStyle = function() {
	if ("client" in this.letter) {
	    var node = this
	    node.span.className = 'unpublished'
	    var promise = node.publish()
	    promise.then(function(){
		node.span.className = 'published'
	    })
	}
    }

    // Option: wrapper for Rule in parse tree
    lw.Option = function(rule,element) {
	this.rule = rule
	this.element = element
    }


    // debug map renderer
    lw.DebugMapView = function(grammarEditor,div) {
	var debugMapView = this;
	extend (this, {grammarEditor: grammarEditor,
		       grammar: grammarEditor.grammar,
		       div: div})

	// clear the DIV
	while (this.div.hasChildNodes())
	    this.div.removeChild (this.div.lastChild)

	// set the map height
	var length = this.grammar.nonterms.length
	var oldStyle = div.getAttribute("style")
	var style = "min-height: " + (1.2*length/2 + 2) + "em"
	div.setAttribute("style",(typeof(oldStyle)=='string' && oldStyle.length) ? (oldStyle+';'+style) : style)

	// create the sigma instance
	this.sigInst = sigma.init(div).drawingProperties({
	    font: "Palatino Linotype",
	    defaultLabelColor: '#000',
	    defaultLabelSize: 14,
	    defaultLabelBGColor: '#000',
	    defaultLabelHoverColor: '#048',
	    labelThreshold: 0,
	    defaultEdgeType: 'curve',
	    defaultEdgeArrow: 'target',
	    defaultEdgeColor: '#000',
	    defaultNodeColor: '#222'
	}).graphProperties({
	    minNodeSize: 0.1,
	    maxNodeSize: 5,
	    minEdgeSize: 5,
	    maxEdgeSize: 5
	}).mouseProperties({
	    maxRatio: 1,
	    minRatio: 1,
	    blockScroll: false
	});

	// add nodes & edges
	var n = 0;
	var isRed = {}
	if (length % 4 > 0)
	    length = length - (length % 4) + 4
	var minStep = 4/length
	for (var n = 0; n < this.grammar.nonterms.length; ++n) {
	    var pos = 4*n/length
	    var angle = (n/length) * Math.PI * 2
	    var x = -Math.cos(angle) // (pos < 2) ? (pos - 1) : (3 - pos)
	    var y = (pos < 1) ? -pos : ((pos < 3) ? (pos - 2 + minStep/2) : (4 - pos))
	    var nonterm = this.grammar.nonterms[n]
	    var id = nonterm.id
	    var bare = nonterm.isBare()
	    var loose = nonterm.looseEnds()
	    var red = isRed[id] = bare || (loose > 0)
	    var orphan = nonterm.isOrphan(this.grammar)
	    this.sigInst.addNode(id,{ label: id.replace(/_/g," "),
				      color: red ? "#ff0000" : (orphan ? "#dd0000" : (nonterm.random ? "#ff88ff" : "#00cc00")),
				      size: red ? 2 : 1,
				      x: x,
				      y: y })
	}

	var gotEdge = {}
	for (var lhs in this.grammar.nonterm)
	    for (var j = 0; j < this.grammar.nonterm[lhs].rules.length; ++j)
		for (var k = 0; k < this.grammar.nonterm[lhs].rules[j].rhs.length; ++k) {
		    var sym = this.grammar.nonterm[lhs].rules[j].rhs[k];
		    if (sym instanceof lw.NontermReference) {
			var rhs = sym.nonterminal.id
			var edgeId = lhs + "." + rhs
			if (!gotEdge[edgeId]) {
			    this.sigInst.addEdge (edgeId, lhs, rhs, {color:isRed[rhs] ? "#ff0000" : (this.grammar.nonterm[lhs].random ? "#eeaaaa" : "#aa8888")})
			    gotEdge[edgeId] = true
			}
		    }
		}

	// mouse over a node hides nodes that aren't connected to it
	this.sigInst
	    .bind('overnodes',function(event){ debugMapView.showNeighbors(event.content) })
	    .bind('outnodes',function(){ debugMapView.showAllNodes() })
	    .bind('downnodes',function(event){
		var nodes = event.content;
		if (nodes.length) {
		    var id = nodes[0]
		    grammarEditor.nontermEditor[id].focus()
		}
	    })

	// draw
	this.sigInst.draw();
    }

    lw.DebugMapView.prototype.showAllNodes = function() {
	this.sigInst.iterEdges(function(e){
	    e.hidden = 0;
	}).iterNodes(function(n){
	    n.hidden = 0;
	}).draw()
    }

    lw.DebugMapView.prototype.showNeighbors = function(nodes) {
	var neighbors = {}, gotNeighbors = false;
	this.sigInst.iterEdges(function(e){
	    if(nodes.indexOf(e.source)>=0 || nodes.indexOf(e.target)>=0){
		neighbors[e.source] = 1;
		neighbors[e.target] = 1;
		gotNeighbors = true;
	    }
	})
	if (gotNeighbors)
	    this.sigInst.iterNodes(function(n){
		if(!neighbors[n.id]){
		    n.hidden = 1;
		}else{
		    n.hidden = 0;
		}
	    }).draw(2,2,2)
    }

    // debug parse tree renderer
    var charsShown = 20  // number of characters to show in long text labels
    lw.DebugParseTreeView = function(letter,div) {
	var debugParseTreeView = this
	extend (this, {letter:letter,
		       div:div})

	// clear the DIV
	while (this.div.hasChildNodes())
	    this.div.removeChild (this.div.lastChild)

	// create the sigma instance
	this.sigInst = sigma.init(div).drawingProperties({
	    font: "Palatino Linotype",
	    defaultLabelColor: '#000',
	    defaultLabelSize: 14,
	    defaultLabelBGColor: '#000',
	    defaultLabelHoverColor: '#048',
	    labelThreshold: 0,
	    defaultEdgeType: 'line',
	    defaultEdgeColor: '#000',
	    defaultNodeColor: '#222'
	}).graphProperties({
	    minNodeSize: 0.1,
	    maxNodeSize: 5,
	    minEdgeSize: 2,
	    maxEdgeSize: 2
	}).mouseProperties({
	    maxRatio: 1,
	    minRatio: 1,
	    blockScroll: false
	});

	// TODO: placeholders & prompts dangling off leaf nodes could be shown?
	// TODO: show notify triggers as arcs?
	// TODO: node mouseover info could include attribute settings at time of expansion?

	// children-together layout
	var nonterms = letter.nontermUsage()
	var terms = letter.termNodes()
	var nonEmptyPreambles = 0;
	function hasPreamble(node) {
	    return ((node.symbol instanceof LetterWriter.NontermReference)
		    && (node === letter.root || node.symbol.nonterminal.preamble != "")) }
	letter.root.iteratePost (function(){ if (hasPreamble(this)) ++nonEmptyPreambles	});
	function countDescendants(node) {
	    var n = hasPreamble(node) ? 1 : 0;
	    ++n;  // include ourself
	    node.iterateChild(function(){ n += countDescendants(this) })
	    if (n % 2 == 0) ++n  // don't be even (kludgy hack to prevent overlapping node labels, doesn't work, euhbguhgueh)
	    return n }
	var debugParseNodes = nonterms + terms + nonEmptyPreambles;

	// some ugly overlap between this function makeNontermId(...) and Node.prototype.nodeIdentifier() ...
	function makeNontermId(node,count,type) {
	    if (typeof node == 'undefined') return undefined
	    if (typeof count == 'undefined') count = node.count
	    if (typeof type == 'undefined') type = ""
	    return "@" + node.symbol.nonterminal.id + type + "/" + count
	}

	function makePreambleId(node) { return makeNontermId(node,undefined,".preamble") }
	function makeTextLabel(id,text) { return (text && /[^\s]/.test(text) ? text : "_") }  // just throws away id at the moment
	function makeTermId(node) { return makeNontermId(node.parent,node.count,".term") }
	function makeCodeId(node) { return makeNontermId(node.parent,node.count,".code") }
	function makeTermLabel(node) { return makeTextLabel(makeTermId(node),node.symbol.text) }
	function makeCodeLabel(node) { return makeTextLabel(makeCodeId(node),node.symbol.asText()) }

	var nodeId = {}
	function quoteHtml(text) { var re1 = /</g, re2 = />/g; return typeof(text)=='undefined'?'<span class="undefinedParameter">undefined</span>' : text.replace(re1,"&lt;").replace(re2,"&gt;") }
	var getAttrs = function(node,attrs) {
	    var attr = {}
	    attr.Text = quoteHtml(node.symbol.asText())
	    if ("expansionDate" in node)
		attr["Expansion time"] = node.expansionDate.toString()
	    if ('hiddenBy' in node)
		attr['Hidden by'] = makeNontermId(node.hiddenBy)
	    return extend(attr,attrs)
	}
	var addNode = function(node,parent,x) {
	    var attr = {Type:"Choice",
			Player:node.symbol.random()?"Computer":"Human",
			Role:node.role+1,
			Expanded:node.leaf?"not yet":"yes",
			stash:{node:node}}
	    var activeRules = 0
	    if (node.symbol instanceof LetterWriter.NontermReference) {
		if (node.leaf) {
		    activeRules = node.symbol.nonterminal.numberOfActiveRules(letter)
		    attr["Expansions available"] = activeRules>0 ? activeRules : '<span class="undefinedParameter">none</span>'
		}
		attr.stash.span = [node.preambleSpan, node.span]
	    }
	    addDebugTreeNode(makeNontermId(node),makeNontermId(parent),extend({label:node.symbol.nonterminal.asText(),x:x,color:node.leaf?(activeRules>0?"#00cc00":"#ff0000"):(node.symbol.random()?"#ff88ff":"#aa8888"),size:node.leaf?2:1},getAttrs(node,attr))) }

	var addPreamble = function(parentNode,x) {
	    var text = parentNode.symbol.nonterminal.preamble
	    addDebugTreeNode(makePreambleId(parentNode),makeNontermId(parentNode),extend({label:makeTextLabel(makePreambleId(parentNode),text),x:x,color:"#ffcc44"},getAttrs(parentNode,{Text:quoteHtml(text),Type:"Preamble",stash:{span:[parentNode.preambleSpan],node:parentNode}}))) }

	var addTerm = function(termNode,x) {
	    addDebugTreeNode(makeTermId(termNode),makeNontermId(termNode.parent),extend({label:makeTermLabel(termNode),x:x,color:"#ffcc44"},getAttrs(termNode,{Type:"Text",stash:{span:[termNode.span],node:termNode.parent}}))) }

	var addCode = function(node,x) {
	    var isAssign = node.symbol instanceof LetterWriter.ParamAssignment
	    var isInput = node.symbol instanceof LetterWriter.ParamInput
	    var attr = {Type:("Parameter "+(isAssign?"assignment":(isInput?"input":"reference"))),stash:{node:node}}
	    if (isAssign || isInput)
		attr.Scope = node.symbol.local ? "Local" : "Global"
	    else
		attr.stash.span = [node.span]
	    var evalsTo = isInput ? undefined : (isAssign ? node.symbol.value.evaluate(node.getScope()) : node.symbol.evaluate(node.getScope()))
	    var isUndef = typeof(evalsTo) == 'undefined'
	    if (!isUndef) attr["Evaluates to"] = quoteHtml(evalsTo.toString())
	    addDebugTreeNode(makeCodeId(node),makeNontermId(node.parent),extend({label:makeCodeLabel(node),x:x,color:isUndef?"#ff0022":(isAssign?"#0000ff":"#0088cc"),size:isUndef?2:1},getAttrs(node,attr))) }

	var depth = {}, maxDepth = 0
	var addDebugTreeNode = function(id,parentId,props) {
	    props = extend ({ label: id,
			      ID: id,
			      color: '#888888',
			      x: 0.5 },
			    props)
	    var parentDepth = (typeof parentId != 'undefined' && parentId in depth) ? depth[parentId] : 0
	    var d = depth[id] = parentDepth + 1
	    if (d > maxDepth) maxDepth = d
	    props = extend (props, { x: d-.5, y: props.x })  // kludge, map x-->y instead of refactoring code, ueguheugehughghhhh
	    if (props.label.length > charsShown)
		props.label = props.label.substring(0,charsShown) + "..."
	    debugParseTreeView.sigInst.addNode(id,props)
	    if (typeof parentId != 'undefined') {
		debugParseTreeView.sigInst.addEdge (id + "." + parentId, id, parentId) } }

	addNode (letter.root, undefined, .5)
	var rootId = makeNontermId (letter.root)

	var iterate = function(xmin,xmax) {
	    var node = this
	    var gotPreamble = hasPreamble(node)
	    var K = countDescendants(node)
	    var c = 0
	    function xrange(node) { 
		var d = typeof(node) == 'undefined' ? 1 : countDescendants(node)
		var xl = xmin + (xmax-xmin) * (c / K)
		c += d
		var xr = xmin + (xmax-xmin) * (c / K)
		return [xl,xr] }
	    function midpoint(lr) {
		return (lr[0] + lr[1]) / 2 }
	    if (gotPreamble)
		addPreamble (node, midpoint(xrange(undefined)))
	    var next = []
	    node.iterateChild(function(){
		var lr = xrange(this)
		var x = midpoint(lr)
		if (this.symbol instanceof LetterWriter.NontermReference)
		    addNode(this,node,x)
		else if (this.symbol instanceof LetterWriter.Term)
		    addTerm(this,x)
		else
		    addCode(this,x)
		next.push([this,lr])})
	    next.map(function(nlr){iterate.apply(nlr[0],nlr[1])})
	}

	iterate.apply (letter.root, [0,1])

	this.sigInst.iterNodes(function(n){
	    n.x /= maxDepth
	});

	var popUp = false, highlightSpan = [];
	function attributesToString(attr) {
	    var text = ""
	    for (var key in attr) {
		var val = attr[key]
		if (val.length > charsShown) val = val.substring(0,charsShown) + "... <i>(truncated)</i>"
		if (key != "stash")  // crude hack: prevent display of objects stashed in sigma's attr hash
		    text += key + " : " + val + " <br>"
	    }
	    return text
	}
	
	function showNodeInfo(event) {
	    hideNodeInfo()
	    
	    var node;
	    debugParseTreeView.sigInst.iterNodes(function(n){
		node = n;
	    },[event.content[0]]);
	    
	    popUp = $('<div/>').append(
		attributesToString( node['attr'] )
	    ).attr(
		'id',
		'node-info'+debugParseTreeView.sigInst.getID()
	    ).css({
		'display': 'inline-block',
		'border-radius': 3,
		'padding': 5,
		'background': '#fff',
		'color': '#000',
		'box-shadow': '0 0 4px #666',
//		'position': 'absolute',
//		'left': node.displayX,
//		'top': node.displayY+15
	    });
	    
	    $('ul',popUp).css('margin','0 0 0 20px');
	    div.appendChild(popUp[0]);

	    if (("stash" in node.attr) && ("span" in node.attr.stash)) {
		highlightSpan = node.attr.stash.span
		for (var i = 0; i < highlightSpan.length; ++i)
		    iterateDom(highlightSpan[i],function(){
			addClassToElement (this, "parseTreeHighlight")
		    })
	    }
	}
	
	function hideNodeInfo() {
	    popUp && popUp.remove();
	    popUp = false;
	    for (var i = 0; i < highlightSpan.length; ++i)
		iterateDom(highlightSpan[i],function(){
		    removeClassFromElement (this, "parseTreeHighlight")
		})
	    highlightSpan = []
	}

	function goToNonterm(event) {
	    var editor;
	    if ("editor" in debugParseTreeView.letter)
		editor = debugParseTreeView.letter.editor;
	    if (typeof (editor) != "undefined") {
		hideNodeInfo()

		var node;
		debugParseTreeView.sigInst.iterNodes(function(n){
		    node = n;
		},[event.content[0]]);

		if (("stash" in node.attr) && ("node" in node.attr.stash) && (node.attr.stash.node.symbol instanceof LetterWriter.NontermReference))
		    editor.nontermEditor[node.attr.stash.node.symbol.nonterminal.id].focus()
	    }
	}
	
	debugParseTreeView.sigInst
	    .bind('overnodes',showNodeInfo)
	    .bind('outnodes',hideNodeInfo)
	    .bind('downnodes',goToNonterm)

	// draw
	debugParseTreeView.sigInst.draw();
    }

    // done
    return lw;
})();

// JQuery Accordion: code to simulate click on intentional hover
// Adapted (hacked) from http://jqueryui.com/accordion/#hoverintent

// Commented out to disable it because it's REALLY ANNOYING - IH 5/27/2013

/*
$.event.special.hoverintent = {
    setup: function() {
	$( this ).bind( "mouseover", jQuery.event.special.hoverintent.handler );
    },
    teardown: function() {
	$( this ).unbind( "mouseover", jQuery.event.special.hoverintent.handler );
    },
    handler: function( event ) {
	var currentX, currentY, timeout,
        args = arguments,
        target = $( event.target ),
        previousX = event.pageX,
        previousY = event.pageY;
	
	function track( event ) {
	    currentX = event.pageX;
	    currentY = event.pageY;
	};
	
	function clear() {
	    target
		.unbind( "mousemove", track )
		.unbind( "mouseout", clear );
	    clearTimeout( timeout );
	}
	
	function handler() {
	    var prop,
	    orig = event;
	    
	    if ( ( Math.abs( previousX - currentX ) +
		   Math.abs( previousY - currentY ) ) < 7 ) {
		clear();
		
		event = $.Event( "hoverintent" );
		for ( prop in orig ) {
		    if ( !( prop in event ) ) {
			event[ prop ] = orig[ prop ];
		    }
		}
		// Prevent accessing the original event since the new event
		// is fired asynchronously and the old event is no longer
		// usable (#6028)
		delete event.originalEvent;
		
		target.trigger( event );
	    } else {
		previousX = currentX;
		previousY = currentY;
		timeout = setTimeout( handler, 300 );
	    }
	}
	
	timeout = setTimeout( handler, 300 );
	target.bind({
	    mousemove: track,
	    mouseout: clear
	});
    }
};
*/