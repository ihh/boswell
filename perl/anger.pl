#!/usr/bin/env perl

my @state = qw(ok angry enraged violent covert isolated resentful contesting);

my %trans = (ok => [ Insult=>angry ],
	     angry => [ Seethe=>angry, Retaliate=>enraged, Challenge=>contesting, Stall=>resentful, Reconcile=>ok ],
	     enraged => [ Seethe=>enraged, Retaliate=>violent, Deescalate=>angry ],
	     violent => [ Seethe=>violent, Deescalate=>enraged ],
	     contesting => [ Declined=>angry, Won=>ok, Lost=>resentful ],
	     resentful => [ Resign=>resentful, Reconcile=>ok, Retaliate=>angry, Passive=>covert, Shunned=>isolated ],
	     covert => [ Snipe=>covert, Shun=>isolated, Vent=>angry ],
	     isolated => [ Stall=>isolated, Peace=>resentful ]);

my %verb = ("Insult" => '$self insults $other',
	    "Seethe" => '$self seethes',
	    "Retaliate" => '$self retaliates against $other',
	    "Challenge" => '$self challenges $other',
	    "Stall" => '$self stalls',
	    "Reconcile" => '$self attempts reconciliation with $other',
	    "Seethe" => '$self seethes',
	    "Deescalate" => '$self de-escalates',
	    "Declined" => '$self feels ignored by $other',
	    "Won" => '$self crows victory over $other',
	    "Lost" => '$self feels humiliated by $other',
	    "Resign" => '$self feels resigned',
	    "Passive" => '$self is passive-aggressive towards $other',
	    "Shunned" => '$self feels shunned',
	    "Snipe" => '$self snipes at $other',
	    "Shun" => '$self shuns $other',
	    "Vent" => '$self vents at $other',
	    "Peace" => '$self makes a peace offering');

my %noun = map (($_=>$_), @state);
$noun{'covert'} = 'covertly violent';
$noun{'violent'} = 'overtly violent';
$noun{'contesting'} = 'argumentative';

sub state_nonterm {
    my ($state1, $state2, $player) = @_;
    return $player == 1 ? ("@".$state1."1_".$state2."2") : ("@".$state2."2_".$state1."1");
}

sub verb_nonterm {
    my ($verb, $player) = @_;
    return "@".lc($verb).$player;
}

my @player = qw(Montresor Fortunato);
sub make_verb {
    my ($hint, $playerNum) = @_;
    --$playerNum;
    my $self = $player[$playerNum];
    my $other = $player[1 - $playerNum];
    return eval('"'.$verb{$hint}.'"') . ".";
}

my @p;
my %h;
for my $src (@state) {
    for my $other (@state) {
	my $opts = $trans{$src};
	my (@rhs1, @rhs2);
	for (my $i = 0; $i < @$opts; $i += 2) {
	    my ($verb, $dest) = @{$opts}[$i,$i+1];
	    push @rhs1, "$verb => ".verb_nonterm($verb,1)." ".state_nonterm($dest,$other,2);
	    push @rhs2, "$verb => ".verb_nonterm($verb,2)." ".state_nonterm($other,$dest,1);
	    if (!defined($h{$verb})) {
		push @p, "#1 random ", verb_nonterm($verb,1), " => {", make_verb($verb,1), "\n}\n";
		push @p, "#2 random ", verb_nonterm($verb,2), " => {", make_verb($verb,2), "\n}\n";
		++$h{$verb};
	    }
	}
	push @p, "#1 ", state_nonterm($src,$other,1), " => [$player[0] is $noun{$src}.\n|Your move, $player[0]?]{", join(" | ",@rhs1), "}\n";
	push @p, "#2 ", state_nonterm($other,$src,2), " => [$player[1] is $noun{$src}.\n|Your move, $player[1]?]{", join(" | ",@rhs2), "}\n";
    }
}

my $start = state_nonterm($state[0],$state[0],1);

print "roles 2\n\@start => { $start }\n", @p;
	     
	     
