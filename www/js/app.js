var _			= require('lodash');
var curry = _.curry;

function AppController ($scope) {
}
AppController.$inject = ["$scope"];

angular.module('textEditor', [
	'ui.router',
	'ngAnimate'
])
.config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
	$stateProvider
	.state('app', {
		url: '/app',
		templateUrl: 'app.html',
		controller: AppController
	});
	$urlRouterProvider.otherwise('/app/editor');
}]);
angular.module('textEditor')
.directive('textEditor', ["TextEditor", "EditorService", function (TextEditor, EditorService) {
	return {
		scope: {
			theme: '=theme'
		},
		link: function (scope, element, attrs) {
			var textEditor = new TextEditor(element);

			EditorService.register('default', textEditor);

			scope.$watch('theme', function (themeName) {
				textEditor.setOption('theme', themeName);
			});

			textEditor.on('change', function () {
				if(!(scope.$$phase || scope.$root.$$phase)) {
					scope.$apply();
				}
			});
		}
	};
}]);
angular.module('textEditor')
.directive('tabsList', ["EditorService", function (EditorService) {
	return {
		restrict: 'E',
		controller: ["$scope", "$element", "$attrs", function ($scope, $element, $attrs) {
			var defaultEditor = EditorService.getEditor('default');

			$scope.tabs = defaultEditor.tabs;
			$scope.setTabActive = function (tab) {
				defaultEditor.setTabActive(tab);
			};

			$scope.isActive = function (tab) {
				var activeTab = defaultEditor.getActiveTab();

				return activeTab && activeTab.id === tab.id;
			};
		}],
		templateUrl: 'app-editor/tabs-list.html'
	};
}])
function DirectoryStructureFactory ($process, $compile, EditorService, DirectoryStructure) {
	return {
		scope: {
			nodes: '=nodes'
		},
		controller: ["$scope", "$element", "$attrs", function ($scope, $element, $attrs) {
			var cwd = $process.cwd();

			var defaultEditor;
			var editorPromise = EditorService.getEditor('default').then(function (editor) {
				defaultEditor = editor;

				return editor;
			});

			this.readFile = function (file) {
				var fileName = file.match(/([^\/]+)$/)[1];

				editorPromise.then(function (editor) {
					editor.readFile({ path: file, name: fileName });
				});
			};

			this.isActive = function (file) {
				var activeTab = defaultEditor.getActiveTab();
				return activeTab && activeTab.compareFile(file);
			};

			DirectoryStructure.getStructure().then(function (directoryStructure) {
				var nodes = directoryStructure.getElements();

				nodes.addClass('files-list');

				$compile(nodes)($scope);

				$element.append(nodes);
			});
		}],
		controllerAs: 'structureCtrl'
	};
}
DirectoryStructureFactory.$inject = ["$process", "$compile", "EditorService", "DirectoryStructure"];

angular.module('textEditor')
.directive('nodeHasChildren', ["$animate", "$helpers", function ($animate, $helpers) {
	function postLink (scope, element, attrs) {
		var apply = $helpers.digest(scope);

		function addClass(addClass) {
			removeClass(false);
		}

		function removeClass(rly) {
			apply(function () {
				$animate[rly === false && 'addClass' ||
				_.isUndefined(rly) && 'removeClass'](element, 'opened')
			});
		}

		element.on('click', function (event) {
			var targetEl 	= event.target;
			var tagName 	= targetEl.tagName;

			if(!((targetEl.tagName === 'A') &&
				targetEl.parentNode === element[0])) {
				return;
			}

			var hasClass = element.hasClass('opened');

			if(hasClass) {
				removeClass();
			} else {
				addClass();
			}
		});
	}

	return {
		compile: function (element, attrs) {
			element
			.children('a')
			.append('<i class="chevron">');

			return postLink;
		}
	};
}])
.directive('directoryStructure', DirectoryStructureFactory);
function EditorController($scope) {
}
EditorController.$inject = ["$scope"];

angular.module('textEditor')
.config(["$stateProvider", function ($stateProvider) {
	$stateProvider
	.state('app.editor', {
		url: '/editor',
		templateUrl: 'app-editor/app-editor.html',
		controller: EditorController,
		controllerAs: 'editorCtrl'
	});
}]);
var _ 						= require('lodash');
var fs 						= require('../modules/fs');
var util						= require('util');
var some					= _.some;
var first					= _.first;
var filter					= _.filter;
var extend				= _.extend;
var isEmpty				= _.isEmpty;
var isEqual				= _.isEqual;
var isArray				= _.isArray;
var forEach				= _.forEach;
var defaults				= _.defaults;
var EditSession 		= ace.require('ace/edit_session').EditSession;
var UndoManager 	= ace.require('ace/undomanager').UndoManager;
var isUndefined		= _.isUndefined;
var EventEmitter		= require('events');

var id = 0;
function getId() {
	id++;
	return id;
}

function Tab (file, editorSession) {
	EventEmitter.call(this);

	this.id = getId();
	this.file = file;
	this.editorSession = editorSession;

	/**
	 * Update the session value
	 * everytime you change your
	 * file content
	 */
	this.on('fileContentUpdated', function () {
		this.editorSession.setValue(this.getFileContent());
	});

	this.updateFileContent();

	this.editorSession.setOption('mode', 'ace/mode/javascript');
}
Tab.prototype = {
	close: function () {
		this.emit('destroy');
		this.editorSession.destroy();
		this.file = undefined;
	},

	getId: function () {
		return this.id;
	},

	hasModifiedContent: function () {
		return !isEqual(this.getFileContent(), this.editorSession.getValue());
	},

	updateContent: function (fileContent) {
		this.file.content = fileContent;

		this.emit('fileContentUpdated');
	},

	updateFileContent: function () {
		var self = this;

		if(!this.file.content) {
			fs.readFile(this.file.path).then((data) => {
				self.updateContent(data.toString());
			});
		}
	},

	saveFile: function () {
		var sessionValue = this.editorSession.getValue();

		this.updateContent(sessionValue);

		return fs.writeFile(this.file.path, sessionValue);
	},

	getFileContent: function () {
		return this.file.content;
	},

	compareFile: function (file) {
		return file.path === this.file.path;
	},

	getFile: function() {
		return this.file;
	},

	getEditorSession: function () {
		return this.editorSession;
	}
};
extend(Tab.prototype, EventEmitter.prototype);

function TextEditor(element, options) {
	var self = this;

	EventEmitter.call(this);

	this.element = element;
	this.node = this.element[0];

	this.initAce();

	this.on('saveActualTab', function () {
		this.emit('savingActualTab');

		var tab = this.getActiveTab();
		tab.saveFile().then(function () {
			self.emit('saveActualTabSuccess');
		});
	});

	this.on('tabChanged', function (tab) {
		this.editor.setSession(tab.getEditorSession());
	});

	this.on('optionChanged', function (key, value) {
		this.editor.setOption(key, value);
	});

	this.on('errorUndefinedOption', function (key, value) {
		console.info(`[ERROR] undefined option value (${key}: ${value})`);
	});

	function onKeypress(e) {
		// Ctrl
		if(e.ctrlKey) {
			switch(e.keyCode) {
				// S
				case 19:
					self.emit('saveActualTab');
					break;
			}
		}
	}
	this.on('focus', function () {
		document.addEventListener('keypress', onKeypress);
	});
	this.on('blur', function () {
		document.removeEventListener('keypress', onKeypress);
	});

	this.setOptions(options);

	forEach(TextEditor.defaults, function (defaultValue, key) {
		if(isUndefined(this.options[key])) {
			this.setOption(key, defaultValue);
		}
	}, this);
	this.createTemporaryTab();
}

TextEditor.prototype = {
	options: {},

	/**
	 * Events to clone from ACE editor instance
	 * to be reemited by TextEditor constructor
	 */
	events: ['blur', 'focus', 'change', 'changeSession'],

	initAce: function () {
		var self = this;

		this.editor = ace.edit(this.node);

		_.forEach(this.events, function (evtName) {
			this.editor.on(evtName, function (e) {
				self.emit(evtName, e);
			});
		}, this);
	},

	getValue: function () {
		return this.editor.getValue();
	},

	setOptions: function (options) {
		forEach(options, function (value, key) {
			this.setOption(key, value);
		}, this);
	},

	setOption: function (key, value) {
		if(isUndefined(value)) {
			this.emit('errorUndefinedOption', key, value);
			return;
		}

		this.options[key] = value;

		this.emit('optionChanged', key, value);
		this.emit(`${key}:optionChanged`, value);
	},

	// Tabs

	tabs: [],

	activeTab: 0,

	addTab: function (tab) {
		this.tabs.push(tab);

		return tab;
	},

	getTabIndex: function (tab) {
		var tabId = tab.getId();
		var tabIndex = 0;

		forEach(this.tabs, function (tab, index) {
			if(tab.id === tabId) {
				tabIndex = index;
			}
		});

		return tabIndex;
	},

	createTemporaryTab: function () {
		var file = {
			content: getId(),
			name: 'untitled',
			path: getId()
		};

		var session = new EditSession('type me out');
		session.setUndoManager(new UndoManager());
		var tab = new Tab(file, session);
		this.addTab(tab);
		this.setTabActive(tab);
	},

	removeTab: function (tab) {
		if(tab.hasModifiedContent() &&
			!(confirm('Are you sure you want to close this tab?'))) {
			return;
		}

		var oldTabIndex = this.getTabIndex(tab);
		this.tabs.splice(oldTabIndex, 1);
		tab = undefined;

		if(isEmpty(this.tabs)) {
			this.createTemporaryTab();
			return;
		}

		if((oldTabIndex - 1) < 0) {
			this.setTabActive(first(this.tabs));
		} else if (oldTabIndex - 1 > this.tabs.length - 1) {
			this.setTabActive(this.tabs[this.tabs.length - 1]);
		} else {
			this.setTabActive(first(this.tabs));
		}
	},

	getTabById: function (tabId) {
		return first(filter(this.tabs, function (tab) {
			return tab.getId() === tabId;
		}));
	},

	setTabActive: function (tabId) {
		var tab;

		if(tabId instanceof Tab) {
			tab = tabId;
			tabId = tab.getId();
		} else {
			tab = this.getTabById(tabId);
		}

		if(this.activeTab === tabId) {
			this.emit('errorAlreadyActiveTabReactivation');
			return;
		}

		var tab = this.getTabById(tabId);
		
		if(!tab) {
			throw new Error(`there is not tab with id ${tabId}`);
		}

		this.activeTab = tab.id;
		this.emit('tabChanged', tab);
	},

	getActiveTab: function () {
		return this.getTabById(this.activeTab);
	},

	getTabByFile: function (file) {
		return first(filter(this.tabs, function (tab) {
			return tab && tab.compareFile(file);
		}));
	},

	tabExists: function (file) {
		return some(this.tabs, function (tab) {
			return tab && tab.compareFile(file);
		});
	},

	readFile: function (file) {
		var self = this;

		if(this.tabExists(file)) {
			this.setTabActive(this.getTabByFile(file).id);
			return;
		}

		var session = new EditSession('');
		session.setUndoManager(new UndoManager());

		var tab = this.addTab(new Tab(file, session));
		this.setTabActive(tab);

		tab.once('destroy', function () {
			self.removeTab(tab);
		});
	},

	getTabs: function () {
		return this.tabs;
	}
};

extend(TextEditor.prototype, EventEmitter.prototype);

TextEditor.defaults = {
	theme: 'ace/styles/github',
	mode: 'ace/mode/javascript'
};

function TextEditorFactory () {
	return TextEditor;
}

function EditorServiceFactory($q) {
	function EditorService () {
		EventEmitter.call(this);

		this.registry = {};
	}
	EditorService.prototype = {
		register: function (key, value) {
			this.registry[key] = value;

			this.emit('editorRegistered', key);
			this.emit(`${key}:editorRegistered`, value);

			return this;
		},

		getEditor: function (key) {
			var self = this;

			var editor = this.registry[key];

			if(isUndefined(editor)) {
				return $q(function (resolve, reject) {
					self.on(`${key}:editorRegistered`, function (editor) {
						resolve(editor);
					});
				});
			}

			return editor;
		}
	};
	extend(EditorService.prototype, EventEmitter.prototype);

	return new EditorService();
}
EditorServiceFactory.$inject = ["$q"];

angular.module('textEditor')
.factory('EditorService', EditorServiceFactory)
.factory('TextEditor', TextEditorFactory);
angular.module('textEditor')
.factory('$process', ["$window", function ($window) {
	return $window.process;
}]);
function $HelpersFactory($timeout) {
	return {
		digest: curry(function (scope, fn) {
			if(scope.$$phase || scope.$root.$$phase) {
				fn(scope);
			} else {
				scope.$apply(fn);
			}
		})
	};
}
$HelpersFactory.$inject = ["$timeout"];

angular.module('textEditor')
.factory('$helpers', $HelpersFactory);
var _						= require('lodash');
var Q 					= require('q');
var fs 					= require('../modules/fs');
var map					= _.map;
var path 				= require('path');
var glob					= require('../modules/glob');
var Node 				= require('../modules/node-element');
var first				= _.first;
var filter				= _.filter;
var forEach			= _.forEach;
var flattenDeep	= _.flattenDeep;
var isUndefined	= _.isUndefined;

function DirectoryStructure(paths) {
	this.paths = paths;
	this.nodes = [];

	forEach(this.paths, function (segments) {
		segments = segments.split('/');

		var nodeName = first(segments);	
		var parentNode = this.getNode(nodeName) ||
											new Node(nodeName);

		this.addNode(this.createNodes(segments, parentNode, 1));
	}, this);
}
DirectoryStructure.getStructure = function () {
	return fs.readdir(process.cwd()).then(function (files) {
		return Q.all(map(filter(files, function (file) {
			return file !== 'node_modules';
		}), function (file) {
			return fs.stat(file).then(function (stat) {
				if(stat.isDirectory()) {
					return glob(path.resolve(file, '**/*.*'));
				} else {
					return file;
				}
			});
		}));
	}).then(function(paths) {
		paths = map(flattenDeep(paths), function (path) {
			return path.replace(`${process.cwd()}/`, '');
		});

		return new DirectoryStructure(paths);
	});
};
DirectoryStructure.prototype = {
	addNode: function (node) {
		if(this.getNode(node.name)) {
			return true;
		} else {
			this.nodes.push(node);
		}
	},
	getElements: function () {
		var container = angular.element('<ul>');

		forEach(this.nodes, function (node) {
			container.append(node.getElement());
		});

		return container;
	},
	getNode: function (name) {	
		return first(filter(this.nodes, function (node) {
			return node.compareName(name);
		}));
	},
	getNodes: function () {
		return this.nodes;
	},
	createNodes: function (segments, parentNode, depth) {
		forEach(segments.slice(depth, depth + 1), function (segment, index) {
			var childNode = parentNode.getChildByName(segment) || new Node(segment);

			// If the parent node doesn't have the actual
			// children node, add to his list 
			if(!parentNode.hasChild(childNode)) {
				parentNode.addChild(childNode);
			}

			// Now we load the next segments, notice that
			// now the parent node will be our childNode
			// and we will have one more depth level
			this.createNodes(segments, childNode, depth + 1);
		}, this);

		return parentNode;
	}
};

angular.module('textEditor')
.factory('DirectoryStructure', function () {
	return DirectoryStructure;
});