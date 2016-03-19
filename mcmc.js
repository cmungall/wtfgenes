(function() {
    var assert = require('assert'),
    Model = require('./model'),
    Parameterization = require('./parameterization'),
    util = require('./util'),
    extend = util.extend

    function logMove(text) {
	console.log ("Move #" + mcmc.samples + ": " + text)
    }

    function logTermMove(move) {
	var mcmc = this
	logMove("Toggle (" + Object.keys(move.termState).map (function(t) {
	    return mcmc.assocs.ontology.termName[t]
	}) + "), Hastings ratio " + move.hastingsRatio + ": "
		+ (move.accepted ? "accepted" : "rejected"))
    }
    
    function run(samples) {
	var mcmc = this
	var sumModelWeight = util.sumList (mcmc.modelWeight)
	var moveRate = [ mcmc.moveRate.flip * sumModelWeight,
			 mcmc.moveRate.swap * sumModelWeight,
			 mcmc.moveRate.param ]
	for (var sample = 0; sample < samples; ++sample) {
	    var moveType = util.sampleIndex (moveRate)
	    switch (moveType) {
	    case 0:
		var model = mcmc.model [util.randomIndex (mcmc.modelWeight)]
		var move = model.proposeFlip()
		model.sampleMove (move)
		logTermMove (move)
		break

	    case 1:
		var model = mcmc.model [util.randomIndex (mcmc.modelWeight)]
		var move = model.proposeSwap()
		model.sampleMove (move)
		logTermMove (move)
		break

	    case 2:
		var counts = mcmc.model.reduce (function(model) {
		    return counts.add (model.getCounts())
		}, mcmc.prior)
		counts.sampleParams (mcmc.params)
		logMove ("Params " + JSON.stringify(mcmc.params.params))
		break

	    default:
		throw new Error ("invalid move type!")
		break;
	    }

	    mcmc.models.forEach (function(model,n) {
		var occupancy = mcmc.termStateOccupancy[n]
		model.activeTerms().forEach (function(term) {
		    ++occupancy[term]
		})
	    })
	    ++mcmc.samples
	}
    }

    function termSummary() {
	var mcmc = this
	return mcmc.termStateOccupancy.map (function (occupancy) {
	    return util.keyValListToObj (occupancy.map (function (occ, term) {
		return [mcmc.ontology.termName[term], occ / mcmc.samples]
	    }))
	})
    }

    function summary() {
	var mcmc = this
	return { samples: mcmc.samples,
		 termSummary: termSummary() }
    }
    
    function MCMC (conf) {
        var mcmc = this

        var assocs = conf.assocs
        var parameterization = conf.parameterization || new Parameterization (conf)
        var prior = conf.prior || parameterization.params.laplacePrior()
        var models = conf.models
            || (conf.geneSets || [conf.geneSet]).map (function(geneSet) {
                return new Model ({ assocs: assocs,
                                    geneSet: geneSet,
                                    parameterization: parameterization,
                                    prior: prior })
            })
        
	var moveRate = { flip: 1, swap: 1, param: 1 }
	if (conf.moveRate)
	    extend (moveRate, conf.moveRate)
	
        extend (mcmc,
                {
		    assocs: assocs,
                    params: parameterization.params,
                    prior: prior,
                    models: models,

		    moveRate: moveRate,
		    modelWeight: models.map (function(model) {
			return model.relevantTerms.length
		    }),
                    
                    samples: 0,
                    termStateOccupancy: models.map (function(model) {
                        return model.termState.map (function() { return 0 })
                    }),

		    run: run,
		    summary: summary
                })
    }

    module.exports = MCMC
}) ()