(function() {
    var assert = require('assert'),
    BernouilliParams = require('./bernouilli').BernouilliParams,
    util = require('./util'),
    extend = util.extend

    function Parameterization (conf) {
        var parameterization = this

        conf = extend ({ termPrior: function(term) { return 't' },
			 geneFalsePos: function(gene) { return 'fp' },
			 geneFalseNeg: function(gene) { return 'fn' },
		       },
		       conf)

        var assocs = conf.assocs
	var termName = assocs.ontology.termName
	var geneName = assocs.geneName

        var params = {}
        function init(f) {
            return function(x) {
                var name = f(x)
                params[name] = 0.5
                return name
            }
        }
        
        parameterization.names = {
            termPrior: termName.map (init (conf.termPrior)),
	    geneFalsePos: geneName.map (init (conf.geneFalsePos)),
	    geneFalseNeg: geneName.map (init (conf.geneFalseNeg))
        }
    
        parameterization.params = new BernouilliParams (params)
    }

    module.exports = Parameterization
}) ()
