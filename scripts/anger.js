var state = ["ok", "angry", "enraged", "violent", "covert", "isolated", "resentful", "contesting"]

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
       "isolated": { "Stall": null, "Peace": "resentful"} }

var responsiveAction
    = { "ok": { "contesting": { "Accept": "contesting" } } }

var reaction
    = {"ok": { "Retaliate": "angry", "Snipe": "angry", "Insult": "angry" },
       "angry": { "Retaliate": "enraged", "Snipe": "enraged", "Insult": "enraged" },
       "enraged": { "Retaliate": "violent", "Snipe": "violent", "Insult": "violent" },
       "contesting": { "Accept": "contesting", "Won": "resentful", "Lost": "ok", "*": "angry" },
       "resentful": { "Shun": "isolated" },
       "covert": { "Shun": "isolated" } }

var player = ['Montresor', 'Fortunato'];

var verbText
    = {"Insult": '$self insults $other',
       "Seethe": '$self seethes',
       "Retaliate": '$self retaliates against $other',
       "Challenge": '$self challenges $other to a dominance contest',
       "Accept": '$self accepts the challenge',
       "Stall": '$self stalls',
       "Reconcile": '$self attempts reconciliation with $other',
       "Seethe": '$self seethes',
       "Deescalate": '$self de-escalates',
       "Declined": '$self feels ignored by $other',
       "Won": '$self crows victory over $other',
       "Lost": '$self feels humiliated by $other',
       "Resign": '$self feels resigned',
       "Passive": '$self is passive-aggressive towards $other',
       "Shunned": '$self feels shunned',
       "Snipe": '$self snipes at $other',
       "Shun": '$self shuns $other',
       "Vent": '$self vents at $other',
       "Peace": '$self makes a peace offering'}

var reactionText
    = {"Insult": "$self bridles at the insult",
       "Retaliate": "$self reacts indignantly to the retaliation",
       "Snipe": "$self sneers at the snipe",
       "Challenge": "$self can't resist the challenge",
       "Won": "$self fumes at the loss",
       "Lost": "$self gloats at the victory",
       "Shun": "$self feels shunned",
       "contesting": "$self feels ignored"}

var nounText = {}
for (var i = 0; i < state.length; ++i)
    nounText[state[i]] = state[i]
nounText['covert'] = 'covertly violent'
nounText['violent'] = 'overtly violent'
nounText['contesting'] = 'argumentative'

function state_nonterm(state1,state2,player) {
    return player == 1 ? ("@"+state1+"1_"+state2+"2") : ("@"+state2+"2_"+state1+"1")
}

function verb_nonterm(verb,player) {
    return "@"+verb.toLowerCase()+player
}

function reaction_verb_nonterm(verb,noun,player) {
    return ((verb == null) || !((verb == "*" ? noun : verb) in reactionText))
	? ""
	: ((verb == "*")
	   ? "@react_while_" + noun.toLowerCase() + player
	   : "@react_to_" + verb.toLowerCase() + player)
}

function noun_nonterm(noun,player) {
    return "@"+noun.toLowerCase()+player
}

function make_noun(n,playerNum) {
    return replace_self_other ('$self is ' + nounText[n] + '.', playerNum)
}

function make_verb(v,playerNum) {
    return replace_self_other (verbText[v] + '.', playerNum)
}

function make_reaction_verb(verb,noun,playerNum) {
    return replace_self_other (reactionText[verb == "*" ? noun : verb] + '.', playerNum)
}

function make_prompt(playerNum) {
    return "Your move, " + player[playerNum-1] + "?"
}

function replace_self_other(text,playerNum) {
    --playerNum
    var self = player[playerNum]
    var other = player[1 - playerNum]
    return text.replace(/\$self/g,self).replace(/\$other/g,other)
}

var p = []
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
	    function makeRule(me,you) {
		return [verb,"=>",
			verb_nonterm(verb,me),
			reaction_verb_nonterm(reactionVerb,srcYou,you),
			noun_nonterm(destYou,you),
			state_nonterm(me==1?destMe:destYou,me==2?destMe:destYou,you)]
		    .join(" ").replace(/ +/g," ")
	    }
	    rhs1.push (makeRule(1,2))
	    rhs2.push (makeRule(2,1))
	}
	p.push ("#1 commit " + state_nonterm(srcMe,srcYou,1) + "=>[" + make_prompt(1) + "]{" + rhs1.join("|") + "}\n")
	p.push ("#2 commit " + state_nonterm(srcYou,srcMe,2) + "=>[" + make_prompt(2) + "]{" + rhs2.join("|") + "}\n")
    }
}

for (var verb in verbText) {
    p.push ("#1 random " + verb_nonterm(verb,1) + " => {" + make_verb(verb,1) + "\n}\n")
    p.push ("#2 random " + verb_nonterm(verb,2) + " => {" + make_verb(verb,2) + "\n}\n")
    if (verb in reactionText) {
	p.push ("#1 random " + reaction_verb_nonterm(verb,null,1) + " => {" + make_reaction_verb(verb,null,1) + "\n}\n")
	p.push ("#2 random " + reaction_verb_nonterm(verb,null,2) + " => {" + make_reaction_verb(verb,null,2) + "\n}\n")
    }
}

for (var noun in nounText) {
    p.push ("#1 random " + noun_nonterm(noun,1) + " => {" + make_noun(noun,1) + "\n}\n")
    p.push ("#2 random " + noun_nonterm(noun,2) + " => {" + make_noun(noun,2) + "\n}\n")
}

for (var i = 0; i < state.length; ++i) {
    var noun = state[i]
    if (noun in reactionText) {
	p.push ("#1 random " + reaction_verb_nonterm("*",noun,1) + " => {" + make_reaction_verb("*",noun,1) + "\n}\n")
	p.push ("#2 random " + reaction_verb_nonterm("*",noun,2) + " => {" + make_reaction_verb("*",noun,2) + "\n}\n")
    }
}

var s = state[0]
var start = state_nonterm(s,s,1)

console.log ("roles 2\n")
console.log ("\@start => {" + noun_nonterm(s,2) + " " + noun_nonterm(s,1) + " " + start + "}\n")
console.log (p.join(""))


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
