var _ = require('lodash');

function inherits (ctor, superCtor) {
	ctor.prototype.__old__ = _.clone(ctor.prototype);
	ctor.prototype.__parent__ = superCtor.prototype;

  _.merge(ctor.prototype, superCtor.prototype);

  console.log(ctor)
}

module.exports = inherits;