// state: lower-case noun describing player's state
var state = ["ok", "angry", "enraged", "violent", "covert", "isolated", "resentful", "contesting"]

// verbs: voluntary transitions, available conditional on the player's state
var action
    = {"ok": { "Insult": null },
       "angry": { "Seethe": null, "Shun": null, "Retaliate": null, "Challenge": "contesting",
		  "Stall": "resentful", "Reconcile": "ok" },
       "enraged": { "Seethe": null, "Retaliate": "violent", "Deescalate": "angry" },
       "violent": { "Seethe": null, "Deescalate": "enraged" },
       "contesting": { "Declined": "angry", "Won": "ok", "Lost": "resentful" },
       "resentful": { "Resign": null, "Reconcile": "ok", "Retaliate": "angry",
		      "Passive": "covert", "Shun": "isolated" },
       "covert": { "Snipe": null, "Vent": "angry", "Shun": null },
       "isolated": { "Stall": null, "Peace": "resentful" } }

// more verbs: voluntary transitions, available conditional on the player and other player's states
// set source state to "*" for voluntary transitions available from all source to a given destination
var responsiveAction = {}
//    = { "ok": { "contesting": { "Accept": "contesting" } } }
add_responsive_action (["ok", "resentful", "angry"], ["contesting"], "Accept", "contesting")

// involuntary transitions, responses to the other player's verbs
var reaction
    = {"ok": { "Insult": "angry" },
       "angry": { "Insult": "enraged" },
       "enraged": { "Insult": "violent" },
       "contesting": { "Accept": "contesting", "Won": "resentful", "Lost": "ok", "*": "angry" },
       "resentful": { "Shun": "isolated" },
       "covert": { "Shun": "isolated" } }

// player names
var player = ['Montresor', 'Fortunato'];

// prompt expansions
var promptText = { "*": 'Your move, $#self?',
		   "covert": 'Your plan, $#self?' }

// hint expansions
var hintText = { "Insult": "Insult $#other",
		 "Retaliate": "Retaliate against $#other",
		 "Snipe": "Snipe at $#other",
		 "Deescalate": "Attempt to calm things down with $#other" }

// default verb expansions
var verbText
    = {"Insult": '$#self insults $#other',
       "Seethe": '$#self seethes',
       "Retaliate": '$#self retaliates against $#other',
       "Challenge": '$#self challenges $#other to a dominance contest',
       "Accept": '$#self accepts the challenge',
       "Stall": '$#self stalls',
       "Reconcile": '$#self tries to set things straight with $#other',
       "Deescalate": '$#self attempts to calm things down',
       "Declined": '$#self sees their challenge ignored by $#other',
       "Won": '$#self crows victory over $#other',
       "Lost": '$#self feels humiliated by $#other',
       "Resign": '$#self feels resigned',
       "Passive": '$#self is passive-aggressive towards $#other',
       "Shunned": '$#self feels shunned',
       "Snipe": '$#self snipes at $#other',
       "Shun": '$#self shuns $#other',
       "Vent": '$#self vents',
       "Peace": '$#self makes a peace offering'}

// expansions of reactions to the other player
// reactions can be "to" their verb-choices, or generic reactions "while" in our noun-states
var reactionText
    = {"Insult": "$#self bridles at the insult",
       "Retaliate": "$#self is indignant",
       "Snipe": "$#self sneers at the snipe",
       "Challenge": "$#self can't resist the challenge",
       "Won": "$#self fumes at the loss",
       "Lost": "$#self gloats at the victory",
       "Shun": "$#self feels shunned",
       "contesting": "$#self sees their challenge ignored"}  // default reaction while contesting

// verb aliases
alias_verb ("Retaliate", "Insult")
alias_verb ("Snipe", "Insult")

// expansions of nouns
var nounText = {}
for (var i = 0; i < state.length; ++i)
    nounText[state[i]] = '$#self is ' + state[i]
nounText['ok'] = '$#self is in excellent spirits'
nounText['covert'] = '$#self contemplates violence'
nounText['violent'] = '$#self exudes violence'
nounText['contesting'] = '$#self is argumentative'

// helpers to build the default grammar
function alias_verb(alias,original) {
    function alias_in_object(obj) {
	if (!(alias in obj) && (original in obj))
	    obj[alias] = obj[original]
    }
    alias_in_object(hintText)
    alias_in_object(verbText)
    alias_in_object(reactionText)
    for (var state in reaction)
	alias_in_object(reaction[state])
}

function add_responsive_action(mySrcStates,yourSrcStates,verb,myDestState) {
    for (var i = 0; i < mySrcStates.length; ++i) {
	var mySrcState = mySrcStates[i]
	for (var j = 0; j < yourSrcStates.length; ++j) {
	    var yourSrcState = yourSrcStates[j]
	    if (!(mySrcState in responsiveAction))
		responsiveAction[mySrcState] = {}
	    if (!(yourSrcState in responsiveAction[mySrcState]))
		responsiveAction[mySrcState][yourSrcState] = {}
	    responsiveAction[mySrcState][yourSrcState][verb] = myDestState
	}
    }
}

var game = { state: state,  // can deduce from action
	     action: action,  // can fold into responsiveAction: action[x]=responsiveAction[x]["*"]
	     responsiveAction: responsiveAction,
	     reaction: reaction,
	     player: player,
	     promptText: promptText,
	     hintText: hintText,
	     // the following can be defined externally:
	     verbText: verbText,
	     reactionText: reactionText,
	     nounText: nounText }


// console.log (JSON.stringify(game))

console.log (make_grammar(game))

// main entry point
function make_grammar(g) {
    var state = g.state, action = g.action, responsiveAction = g.responsiveAction, reaction = g.reaction
    var player = g.player
    var promptText = g.promptText, hintText = g.hintText, verbText = g.verbText, reactionText = g.reactionText, nounText = g.nounText

    // grammar symbol constructors
    function state_nonterm(state1,state2,player) {
	return '@state'
//	return player == 1 ? ("@"+state1+"1_"+state2+"2") : ("@"+state2+"2_"+state1+"1")
    }

    function verb_nonterm(verb,player) {
	if (player == null) player = ""
	return "@"+verb.toLowerCase()+player
    }

    function reaction_verb_nonterm(verb,noun,player) {
	if (player == null) player = ""
	return ((verb == null) || !((verb == "*" ? noun : verb) in reactionText))
	    ? ""
	    : ((verb == "*")
	       ? "@react_while_" + noun.toLowerCase() + player
	       : "@react_to_" + verb.toLowerCase() + player)
    }

    function noun_nonterm(noun,player) {
	if (player == null) player = ""
	return "@"+noun.toLowerCase()+player
    }

    // expansion text constructors
    function make_noun(n,playerNum) {
	return replace_self_other (nounText[n] + '.', playerNum)
    }

    function make_verb(v,playerNum) {
	return replace_self_other (verbText[v] + '.', playerNum)
    }

    function make_reaction_verb(verb,noun,playerNum) {
	return replace_self_other (reactionText[verb == "*" ? noun : verb] + '.', playerNum)
    }

    function make_prompt(state,playerNum) {
	return replace_self_other (promptText[(state in promptText) ? state : "*"], playerNum)
    }


    function make_hint(verb,playerNum) {
	return replace_self_other ((verb in hintText) ? hintText[verb] : verb, playerNum)
    }

    function define_role_array(paramName,values) {
	var a = []
	for (var i = 0; i < values.length; ++i) {
	    a.push ('$' + paramName + '[' + (i+1) + ']="' + values[i] + '";')
	}
	return a.join('')
    }

    function pause(nonterm) {
	return nonterm.length ? (nonterm+';') : ''
    }

    function commit(nonterm) {
	return nonterm.length ? (nonterm+'!') : ''
    }

    // expansion text macro
    function replace_self_other(text,playerNum) {
	if (playerNum != null) {
	    --playerNum
	    var self = player[playerNum]
	    var other = player[1 - playerNum]
	    text = text.replace(/\$#self/g,self).replace(/\$#other/g,other)
	}
	return text
    }

    // build grammar
    var p = [], rule = []
    for (var i = 0; i < state.length; ++i) {
	var srcMe = state[i]
	for (var j = 0; j < state.length; ++j) {
	    var srcYou = state[j]
	    var actionTransition = extend ({}, action[srcMe])
	    if ((srcMe in responsiveAction) && (srcYou in responsiveAction[srcMe]))
		actionTransition = extend (actionTransition, responsiveAction[srcMe][srcYou])
	    if (("*" in responsiveAction) && (srcYou in responsiveAction["*"]))
		actionTransition = extend (actionTransition, responsiveAction["*"][srcYou])
	    var reactionTransition = (srcYou in reaction) ? reaction[srcYou] : {}
	    var rhs1 = [], rhs2 = []
	    for (var verb in actionTransition) {
		var destMe = actionTransition[verb]
		if (destMe == null)
		    destMe = srcMe
		var reactionVerb = (verb in reactionTransition)
		    ? verb
		    : (("*" in reactionTransition)
		       ? "*"
		       : null)
		var destYou = reactionVerb==null ? srcYou : reactionTransition[reactionVerb]

		// the rule builder
		function make_rule(me,you) {
		    return [make_hint(verb,me),"=>",
			    pause(verb_nonterm(verb,me)),
			    pause(reaction_verb_nonterm(reactionVerb,srcYou,you)),
			    pause(noun_nonterm(destYou,you)),
			    commit(state_nonterm(me==1?destMe:destYou,me==2?destMe:destYou,you))]
			.join("")
		}

		rhs1.push (make_rule(1,2))
		rhs2.push (make_rule(2,1))
	    }
	    p.push ("#1 " + state_nonterm(srcMe,srcYou,1) + "=>[" + make_prompt(srcMe,1) + "]{" + rhs1.join("|") + "}\n")
	    p.push ("#2 " + state_nonterm(srcYou,srcMe,2) + "=>[" + make_prompt(srcMe,2) + "]{" + rhs2.join("|") + "}\n")
	}
    }

    for (var verb in verbText) {
	p.push ("\n")
	p.push ("#1 random " + verb_nonterm(verb,1) + " => {" + verb_nonterm(verb,null)
//		+ "|" + make_verb(verb,1) + "\n"
		+ "}\n")
	p.push ("#2 random " + verb_nonterm(verb,2) + " => {" + verb_nonterm(verb,null)
//		+ "|" + make_verb(verb,2) + "\n"
		+ "}\n")
	p.push ("#= random " + verb_nonterm(verb,null) + " => {" + make_verb(verb,null) + "\n}\n")

	if (verb in reactionText) {
	    p.push ("\n")
	    p.push ("#1 random " + reaction_verb_nonterm(verb,null,1) + " => {" + reaction_verb_nonterm(verb,null,null)
//		    + "|" + make_reaction_verb(verb,null,1) + "\n"
		    + "}\n")
	    p.push ("#2 random " + reaction_verb_nonterm(verb,null,2) + " => {" + reaction_verb_nonterm(verb,null,null)
//		    + "|" + make_reaction_verb(verb,null,2) + "\n"
		    + "}\n")
	    p.push ("#= random " + reaction_verb_nonterm(verb,null,null) + " => {" + make_reaction_verb(verb,null,null) + "\n}\n")
	}
    }

    for (var noun in nounText) {
	p.push ("\n")
	p.push ("#1 random " + noun_nonterm(noun,1) + " => {" + noun_nonterm(noun,null)
//		+ "|" + make_noun(noun,1) + "\n"
		+ "}\n")
	p.push ("#2 random " + noun_nonterm(noun,2) + " => {" + noun_nonterm(noun,null)
//		+ "|" + make_noun(noun,2) + "\n"
		+ "}\n")
	p.push ("#= random " + noun_nonterm(noun,null) + " => {" + make_noun(noun,null) + "\n}\n")
    }

    for (var i = 0; i < state.length; ++i) {
	var noun = state[i]
	if (noun in reactionText) {
	    p.push ("\n")
	    p.push ("#1 random " + reaction_verb_nonterm("*",noun,1) + " => {" + reaction_verb_nonterm("*",noun,null)
//		    + "|" + make_reaction_verb("*",noun,1) + "\n"
		    + "}\n")
	    p.push ("#2 random " + reaction_verb_nonterm("*",noun,2) + " => {" + reaction_verb_nonterm("*",noun,null)
//		    + "|" + make_reaction_verb("*",noun,2) + "\n"
		    + "}\n")
	    p.push ("#= random " + reaction_verb_nonterm("*",noun,null) + " => {" + make_reaction_verb("*",noun,null) + "\n}\n")
	}
    }

    function extend (destination, source) {  // source overwrites destination
	if (typeof(source) != "undefined") {
	    for (var property in source) {
		if (source.hasOwnProperty(property))
		    if (!destination.hasOwnProperty(property))
			destination[property] = source[property];
	    }
	}
	return destination;
    }

    // main return
    var s = state[0]
    var start = state_nonterm(s,s,1)

    var result = []
    result.push ("roles 2\n")
    var startSymbols = [define_role_array('self',player),
			define_role_array('other',player.slice(0).reverse()),
			pause(noun_nonterm(s,2)),
			pause(noun_nonterm(s,1)),
			commit(start)]
    result.push ("\@start => {" + startSymbols.join('') + "}\n")
    result.push (p.join(""))

    return result.join('')
}

