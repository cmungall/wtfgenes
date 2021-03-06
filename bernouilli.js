(function() {
    var util = require('./util'),
        extend = util.extend,
        assert = require('assert'),
        jStat = require('jStat').jStat

    function update (bp, param) {
	var val = bp._params[param]
	bp._logYes[param] = Math.log (val)
	bp._logNo[param] = Math.log (1 - val)
    }

    function logLikelihood (params, counts) {
	var ll = 0
	for (var param in counts.succ)
	    if (counts.succ.hasOwnProperty (param))
		ll += params._logYes[param] * counts.succ[param]
	for (var param in counts.fail)
	    if (counts.fail.hasOwnProperty (param))
		ll += params._logNo[param] * counts.fail[param]
	return ll
    }

    function logPrior (params, priorCounts) {
	var lp = 0
	for (var param in params._params)
            lp += Math.log (jStat.beta.pdf (params._params[param],
					    priorCounts.succ[param] + 1,
					    priorCounts.fail[param] + 1))
	return lp
    }

    function logBetaBernouilliLikelihood (priorCounts) {
	var counts = this
	var l = 0
	var allCounts = [priorCounts.succ, priorCounts.fail, counts.succ, counts.fail].reduce (util.extend, {})
	Object.keys(allCounts).forEach (function (param) {
	    l += util.logBetaBernouilli ((priorCounts.succ[param] || 0) + 1,
					 (priorCounts.fail[param] || 0) + 1,
					 counts.succ[param] || 0,
					 counts.fail[param] || 0)
	})
	return l
    }

    function deltaLogBetaBernouilliLikelihood (deltaCounts) {
	var counts = this
	var d = 0
	var allCounts = [deltaCounts.succ, deltaCounts.fail, this.succ, this.fail].reduce (util.extend, {})
	Object.keys(allCounts).forEach (function (param) {
	    var oldSucc = counts.succ[param] || 0
	    var oldFail = counts.fail[param] || 0
	    var newSucc = oldSucc + (deltaCounts.succ[param] || 0)
	    var newFail = oldFail + (deltaCounts.fail[param] || 0)

	    d += jStat.betaln(newSucc+1,newFail+1) - jStat.betaln(oldSucc+1,oldFail+1)
	})
	return d
    }

    function copyCounts() {
	return new BernouilliCounts (this)
    }

    function add (counts) {
	return this.copy().accum(counts)
    }

    function accum (counts) {
	assert (this.params === counts.params)
        function accWithDelete (c, c2, param) {
	    var newCount = c2[param] + (c[param] || 0)
            if (newCount)
                c[param] = newCount
            else
                delete c[param]
        }
	for (var param in counts.succ)
            accWithDelete (this.succ, counts.succ, param)
	for (var param in counts.fail)
            accWithDelete (this.fail, counts.fail, param)
	return this
    }

    function sampleParams(params) {
	for (var param in params._params)
            params.setParam (param, jStat.beta.sample (this.succ[param] + 1, this.fail[param] + 1))
	return params
    }

    function BernouilliParamSet (params) {
        var bp = this
	extend (bp, {
	    _params: params || {},
	    params: function() { return Object.keys(this._params).sort() },
	    addParam: function(param) { this._params[param] = 1 },
	    toJSON: function() { return this.params() },
	    newParams: function(p) { return new BernouilliParams (extend ({ params: this }, p)) },
	    newCounts: function(c) { return new BernouilliCounts (extend ({ params: this }, c)) },
	    laplacePrior: function() {
                var c = this.newCounts()
                this.params().forEach (function(p) { c.succ[p] = c.fail[p] = 1 })
                return c
            }
	})
    }

    function BernouilliCounts (counts, params) {
        var bc = this
	extend (bc, {
	    params: params || counts.params,
	    succ: extend ({}, counts.succ),
	    fail: extend ({}, counts.fail),
	    logLikelihood: function(params) { return logLikelihood(params,this) },
	    logPrior: function(params) { return logPrior(params,this) },
	    logLikeWithPrior: function(prior,params) {
                return prior.logPrior(params) + logLikelihood(params,this)
            },
	    logBetaBernouilliLikelihood: logBetaBernouilliLikelihood,
	    deltaLogBetaBernouilliLikelihood: deltaLogBetaBernouilliLikelihood,
	    copy: copyCounts,
	    add: add,
	    accum: accum,
            sampleParams: sampleParams,
	    toJSON: function() { return { succ: this.succ, fail: this.fail } }
	})
    }

    function BernouilliParams (params) {
        var bp = this
	extend (bp, {
	    _params: params || {},
	    _logYes: {},
	    _logNo: {},
	    params: function() { return Object.keys(this._params).sort() },
	    getParam: function(param) { return this._params[param] },
	    setParam: function(param,val) { this._params[param] = val; update (bp, param) },
	    logLikelihood: function(count) { return logLikelihood(this,count) },
	    logPrior: function(prior) { return logPrior(this,prior) },
	    logLikeWithPrior: function(prior,count) { return logPrior(this,prior) + logLikelihood(this,count) },
	    toJSON: function() { return extend ({}, this._params) },
	    newCounts: function(c) { return new BernouilliCounts (extend ({ params: this }, c)) },
	    laplacePrior: function() {
                var c = this.newCounts()
                this.params().forEach (function(p) { c.succ[p] = c.fail[p] = 1 })
                return c
            }
	})
	Object.keys(params).forEach (function(param) {
	    update (bp, param)
	})
    }

    module.exports.BernouilliParamSet = BernouilliParamSet
    module.exports.BernouilliParams = BernouilliParams
    module.exports.BernouilliCounts = BernouilliCounts
}) ()
