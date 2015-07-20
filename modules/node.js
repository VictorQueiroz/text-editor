function Node(name) {
	this.name = name;
	this.childrens = [];
}
Node.prototype = {
	setParent: function (node) {
		this.parent = node;
		return this;
	},
	getParent: function () {
		return this.parent;
	},
	getName: function () {
		return this.name;
	},
	addChilds: function (nodes) {
		forEach(nodes, function (node) {
			this.addChild(node);
		}, this);

		return this;
	},
	addChild: function (node) {
		this.childrens.push(node.setParent(this));
		return this;
	},
	getChilds: function () {
		return this.childrens;
	},
	hasChild: function (childNode) {
		if(childNode) {
			return this.childrens.indexOf(childNode) > -1;
		} else {
			return this.childrens.length > 0;
		}
	},
	compareName: function (name) {
		return this.name === name;
	},
	getChildByName: function (name) {
		return first(filter(this.getChilds(), function (node) {
			return node && node.compareName(name);
		}));
	},
	hasParent: function () {
		return !this.isParent();
	},
	isParent: function () {
		return isUndefined(this.parent);
	}
};

module.exports = Node;