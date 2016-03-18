(function() {
    var assert = require('assert'),
    BernouilliParams = require('./bernouilli'),
    util = require('./util'),
    extend = util.extend

    function getTermState(t) { return this._termState[t] }

    function setTermState(t,val) {
	var explan = this
        assert (explan.isRelevant[t])
	if (explan._termState[t] != val) {
	    var delta = val ? +1 : -1
	    explan.assocs.genesByTerm[t].forEach (function(g) {
		explan._nActiveTermsByGene[g] += delta
	    })
	    if (val)
		explan._isActiveTerm[t] = true
	    else
		delete explan._isActiveTerm[t]
	    explan._termState[t] = val
	}
    }

    function setTermStates(termStateAssignment) {
        for (var t in termStateAssignment)
            if (termStateAssignment.hasOwnProperty(t))
                this.setTermState (t, termStateAssignment[t])
    }

    function countTerm(explan,counts,inc,t,state) {
        var countObj = state ? counts.succ : counts.fail
        var countParam = explan.param.termPrior[t]
        countObj[countParam] = inc + (countObj[countParam] || 0)
    }
    
    function countObs(explan,counts,inc,isActive,g) {
        var inGeneSet = explan._inGeneSet[g]
	// isActive inGeneSet param
	// 0        0         !falsePos
	// 0        1         falsePos
	// 1        0         falseNeg
	// 1        1         !falseNeg
        var isFalse = isActive ? !inGeneSet : inGeneSet
        var countObj = isFalse ? counts.succ : counts.fail
        var countParam = (isActive ? explan.param.geneFalseNeg : explan.param.geneFalsePos)[g]
        countObj[countParam] = inc + (countObj[countParam] || 0)
    }
    
    function getCounts() {
	var explan = this
	var counts = explan.params.newCounts()
	var param = explan.param
	explan.relevantTerms.forEach (function (t) {
            countTerm (explan, counts, +1, t, explan._termState[t])
	})
	explan._nActiveTermsByGene.forEach (function (active, g) {
            countObs (explan, counts, +1, active > 0, g)
	})
	return counts
    }

    function getCountDelta(termStateAssignment) {
	var explan = this
	var param = explan.param
	var cd = explan.params.newCounts()
        var nActiveTermsByGene = {
            _val: {},
            val: function(g) { return this._val[g] || explan._nActiveTermsByGene[g] },
            add: function(g,delta) { var oldval = this.val(g); this._val[g] = oldval + delta; return oldval }
        }
        for (var t in termStateAssignment)
            if (termStateAssignment.hasOwnProperty(t)) {
                assert (explan.isRelevant[t])
                var val = termStateAssignment[t]
	        if (explan._termState[t] != val) {
                    countTerm (explan, cd, -1, t, explan._termState[t])
                    countTerm (explan, cd, +1, t, val)
	            var delta = val ? +1 : -1
	            explan.assocs.genesByTerm[t].forEach (function(g) {
		        var oldActive = nActiveTermsByGene.add(g,delta)
		        var newActive = nActiveTermsByGene.val(g)
		        if (oldActive != newActive) {
                            countObs (explan, cd, -1, oldActive, g)
                            countObs (explan, cd, +1, newActive, g)
		        }
	            })
	        }
            }
	return cd
    }

    function invert(termStateAssignment) {
        var inv = extend ({}, termStateAssignment)
        for (var t in inv)
            inv[t] = this._termState[t]
        return inv
    }

    function Explanation (conf) {
        var explan = this
	var isActive = {}
	conf = extend ( { 'termPrior': function(term) { return "t" },
			  'geneFalsePos': function(gene) { return "fp" },
			  'geneFalseNeg': function(gene) { return "fn" },
			  'termState': function(term) { return isActive[term] ? 1 : 0 }
			},
			conf)
	var assocs = conf.assocs
	var termName = assocs.ontology.termName
	var geneName = assocs.geneName

        var geneSet = conf.geneSet.map (function(g) {
            return assocs.geneIndex[g]
        })

	if ('terms' in conf)
	    conf.terms.forEach (function(term) { isActive[term] = true })
	var termState = termName.map (conf.termState)

        // "relevant" terms are ones which have at least one associated gene in the geneSet
        var relevantTerms = util.removeDups (geneSet.reduce (function(termList,g) {
	    return termList.concat (assocs.termsByGene[g])
	}, [])).map(util.parseDecInt).sort(util.numCmp)
        var isRelevant = util.listToCounts (relevantTerms)
        function relevantFilter(termList) {
            return termList.filter (function(t) { return isRelevant[t] })
        }

        // this object encapsulates both the graphical model itself,
        // and an assignment of state to the model variables
        extend (explan,
                {
                    // the graphical model
                    assocs: assocs,
		    geneSet: geneSet,
		    termName: termName,
		    geneName: geneName,

		    _inGeneSet: geneName.map (function() { return false }),

                    isRelevant: isRelevant,
		    relevantTerms: relevantTerms,
                    relevantParents: assocs.ontology.parents.map (relevantFilter),
                    relevantChildren: assocs.ontology.children.map (relevantFilter),

		    param: {
		        termPrior: termName.map (conf.termPrior),
		        geneFalsePos: geneName.map (conf.geneFalsePos),
		        geneFalseNeg: geneName.map (conf.geneFalseNeg)
		    },

		    params: null,
                    genes: function() { return this.assocs.genes() },
                    terms: function() { return this.assocs.terms() },

                    // current state of the model
		    _termState: termState,
		    _isActiveTerm: {},

		    _nActiveTermsByGene: assocs.termsByGene.map (function(terms) {
		        return terms.reduce (function(accum,t) {
			    return accum + (termState[t] ? 1 : 0)
		        }, 0)
		    }),

                    activeTerms: function() {
                        return Object.keys(this._isActiveTerm).sort(util.numCmp)
                    },
                    
		    getTermState: getTermState,
		    setTermState: setTermState,
		    setTermStates: setTermStates,
                    invert: invert,
                    
		    getCounts: getCounts,
		    getCountDelta: getCountDelta,

		    toJSON: function() {
		        var explan = this
		        return explan.activeTerms()
			    .map (function(t) { return explan.termName[t] })
		    }
                })

	geneSet.forEach (function(g) { explan._inGeneSet[g] = true })
	termState.forEach (function(s,t) { if (s) explan._isActiveTerm[t] = true })

        if (conf.params)
	    explan.params = conf.params
        else {
	    var param = {}
	    function initParam(p) { param[p] = .5 }
	    explan.param.termPrior.map (initParam)
	    explan.param.geneFalsePos.map (initParam)
	    explan.param.geneFalseNeg.map (initParam)
            explan.params = new BernouilliParams (param)
        }
        explan.prior = conf.prior || explan.params.laplacePrior()
    }

    module.exports = Explanation
}) ()
