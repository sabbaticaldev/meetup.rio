self.APP_ENV = "PRODUCTION";
(async () => {
	await (async () => {
const BASE_PATH = "";

const IS_MV3 =
	typeof self.chrome !== "undefined" &&
	!!self.chrome.runtime &&
	!!self.chrome.runtime.id;

const ENV = self.APP_ENV || "DEVELOPMENT";

self.APP = {
	config: { BASE_PATH, IS_MV3, ENV },
	components: new Map(),
	style: new Set(),
	Icons: {},
	events: {},
	extensions: {},
	routes: {},
	adapters: {},
	data: {},
	theme: {},
	models: {},
	fontsToLoad: [],
	init: [],
	READY: false,
	IS_MV3,
	IS_DEV: ENV === "DEVELOPMENT",
	add: (item, { style = false, tag, prop, library } = {}) => {
		if (self.APP.config.ENV === "PRODUCTION" && prop === "init") {
			if (Array.isArray(item)) item.map((fn) => fn());
			else item();
			return;
		}
		if (typeof library === "string") {
			APP[library] = item;
			return;
		}
		if (typeof item === "function") {
			item.tag = tag;
			APP.components.set(item.tag, item);
			if (style === true) {
				APP.style.add(item.tag);
			}
		} else if (typeof item === "object") {
			if (!APP[prop]) {
				APP[prop] = Array.isArray(item) ? [] : {};
			}

			if (Array.isArray(item)) {
				APP[prop] = [...APP[prop], ...item];
			} else {
				Object.assign(APP[prop], item);
			}
		}
	},
};

})();
await (async () => {
const FileSystem = {
	entries: new Map(),
	components: new Map(),
	add(path, type, tag) {
		if (tag) {
			this.components.set(tag, path);
		} else {
			if (!this.entries.has(type)) {
				this.entries.set(type, new Set());
			}
			this.entries.get(type).add(path);
		}
	},
	remove(path, type) {
		if (this.entries.has(type)) {
			this.entries.get(type).delete(path);
		}
		for (const [name, entry] of this.namedEntries) {
			if (entry.path === path && entry.type === type) {
				this.namedEntries.delete(name);
				break;
			}
		}
	},
	getAllEntries() {
		const entries = {};
		for (const [type, paths] of this.entries) {
			entries[type] = [...paths];
		}
		entries.components = Object.fromEntries(this.components);
		return entries;
	},
};
FileSystem.add("/app.js", "js");
FileSystem.add("/bootstrap.js", "js");
FileSystem.add("Icons", "json");
const importJS = async (path, { tag, dev = false } = {}) => {
	try {
		if (!dev) FileSystem.add(path, "js", tag);
		return self.importScripts ? self.importScripts(path) : import(path);
	} catch (error) {
		console.error(`Error loading script ${path}:`, error);
	}
};

const fetchResource = async (path, handleResponse, type, skipFS) => {
	try {
		const response = await fetch(path);
		if (response.ok) {
			if (!skipFS) FileSystem.add(path, type);
			return await handleResponse(response);
		}
	} catch (error) {
		console.warn(`Resource not found at: ${path}`, error);
	}
	return null;
};

const fetchJSON = (path) =>
	fetchResource(path, (response) => response.json(), "json", true);

const getExtensionPath = (extension, fileName) =>
	`${self.APP.config.BASE_PATH}/extensions/${extension}/${fileName}`;

const loadExtension = async (extension, APP, backend = false) => {
	try {
		if (APP.extensions?.[extension]) return null;

		const extensionJson = await fetchJSON(
			getExtensionPath(extension, "extension.json"),
		);
		if (!extensionJson) return;

		const {
			backend: isBackend,
			frontend: isFrontend,
			library: isLibrary,
			data: hasData,
		} = extensionJson;

		if (backend && !isBackend && !isLibrary) return;
		if (!backend && !isFrontend && !isLibrary) return;

		APP.extensions[extension] = extensionJson;

		if (Array.isArray(extensionJson.extensions)) {
			for (const nestedExtension of extensionJson.extensions) {
				await loadExtension(nestedExtension, APP, backend);
			}
		}

		if (isLibrary) {
			await importJS(getExtensionPath(extension, "index.js"), {
				dev: extensionJson.dev,
			});
		}

		if (isFrontend && !backend) {
			await importJS(getExtensionPath(extension, "index.frontend.js"), {
				dev: extensionJson.dev,
			});
		}

		if (isBackend && backend) {
			await importJS(getExtensionPath(extension, "index.backend.js"), {
				dev: extensionJson.dev,
			});
		}

		if (hasData) {
			const dataPath = getExtensionPath(extension, "data.json");
			const extensionData = await fetchJSON(dataPath);
			if (extensionData) {
				APP.data = { ...APP.data, ...extensionData };
			}
		}

		if (extensionJson.font) {
			APP.fontsToLoad.push({ extension, fontConfig: extensionJson });
		}

		self.dispatchEvent(new Event(`${extension}Loaded`));
		console.log(`Extension ${extension} loaded successfully`);

		return [extension, extensionJson];
	} catch (error) {
		console.error(`Failed to load extension ${extension}:`, error);
		return null;
	}
};

const loadAllExtensions = async (extensions, APP, backend) => {
	for (const extension of extensions) {
		await loadExtension(extension, APP, backend);
	}
	return APP.extensions;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

self.APP.add(
	{ fetchJSON, importJS, fetchResource, sleep },
	{ prop: "helpers" },
);
self.APP.add(FileSystem, { library: "FileSystem" });

self.APP.bootstrap = async (backend = false) => {
	try {
		const project = await fetchJSON("/project.json");
		if (!project) throw new Error("Project configuration not found");

		const { extensions } = project;
		if (extensions) await loadAllExtensions(extensions, APP, backend);

		for (const initFn of APP.init) {
			await initFn(project);
		}

		self.dispatchEvent(new Event("APPLoaded"));
		self.APP.READY = true;

		if (backend) return { models: APP.models, data: APP.data };

		if (typeof document !== "undefined") {
			for (const { extension, fontConfig } of APP.fontsToLoad) {
				APP.helpers.loadFont(extension, fontConfig);
			}
		}

		if (typeof window !== "undefined" && self.APP.config.DEV_SERVER) {
			const ws = new WebSocket(self.APP.config.DEV_SERVER);
			ws.addEventListener("message", (event) => {
				if (event.data === "refresh") {
					console.log("DEBUG: Received refresh request");
					if (self.APP.config.IS_MV3) {
						window.location.href = `extension.html?url=${self.APP.Router.currentRoute.path}`;
					} else {
						window.location.reload();
					}
				}
			});
		}

		console.log("Loaded files:", APP.FileSystem.getAllEntries());
	} catch (error) {
		console.error("Bootstrap failed:", error);
	}
};

})();
await (async () => {
const parseJSON = (value, defaultValue) => {
	try {
		return value && typeof value === "string" ? JSON.parse(value) : value;
	} catch (error) {
		console.log("Failed to parse JSON from string:", error);
		return defaultValue;
	}
};

const typeHandlers = {
	boolean: (value) => ["true", 1, true].includes(value),
	string: (value) => String(value),
	array: (value, defaultValue, itemType) => {
		try {
			if (!value) return [];
			const parsedArray = parseJSON(value, defaultValue);
			return parsedArray.map((item) => {
				if (itemType) {
					return Object.entries(item).reduce((obj, [key, value]) => {
						obj[key] = typeHandlers[itemType[key].type](
							value,
							itemType[key].defaultValue,
						);
						return obj;
					}, {});
				}
				return item;
			});
		} catch (err) {
			return value;
		}
	},
	number: (value, defaultValue) =>
		Number.isNaN(Number(value)) ? defaultValue : Number(value),
	date: (value) => new Date(value),
	function: (value) => (value ? new Function(value) : undefined),
	object: (value, defaultValue) => parseJSON(value, defaultValue),
};
const specialCases = {
	null: null,
	undefined: undefined,
	false: false,
	true: true,
	[null]: null,
	[undefined]: undefined,
	[false]: false,
	[true]: true,
};

const stringToType = (value, prop) => {
	if (value in specialCases) return specialCases[value];
	const handler = typeHandlers[prop.type];
	return handler
		? handler(value, prop.defaultValue, prop.itemType || prop.objectType)
		: value || prop.defaultValue;
};

const createType = (type, options = {}) => ({
	type,
	reflect: !options.sync,
	defaultValue: options.defaultValue || undefined,
	...options,
	attribute: options.attribute || true,
});

const handler = () => ({
	get(target, prop) {
		if (typesHelpers[prop]) return typesHelpers[prop];
		if (prop === "one" || prop === "many") {
			return (targetModel, targetForeignKey, options = {}) => ({
				type: prop === "one" ? "string" : "array",
				relationship: prop,
				targetModel,
				targetForeignKey,
				...options,
				index: true,
			});
		}

		return (options = {}) => {
			const type = prop.toLowerCase();
			if (!typeHandlers[type]) {
				throw new Error(`Unknown type: ${type}`);
			}
			return createType(type, options);
		};
	},
});
const validateField = (value, prop) => {
	let error = null;

	// Required validation
	if (
		prop.required &&
		(value === undefined || value === null || value === "")
	) {
		return [`Field ${prop.key} is required`, null];
	}

	// Type validation
	const propType = prop.type;
	const typeHandler = typeHandlers[propType];
	const typedValue = typeHandler
		? typeHandler(value, prop.defaultValue)
		: value;

	// Format validation
	if (prop.format && typeof prop.format === "function") {
		const isValid = prop.format(typedValue);
		if (!isValid) {
			error = `Invalid format for field ${prop.key}`;
		}
	}

	return [error, typedValue];
};

const validateType = (object, { schema, row = {} }) => {
	if (!schema) return [null, object];

	const result = {};
	let hasError = false;
	const errors = {};
	const derivedFields = [];

	// First pass: validate non-derived fields
	for (const key in schema) {
		const prop = schema[key];
		let value = object[key];
		let error;

		if (prop.derived && typeof prop.derived === "function") {
			derivedFields.push(key); // Postpone derived fields
			continue;
		}

		[error, value] =
			value !== undefined
				? validateField(value, prop)
				: [null, prop.defaultValue];

		if (error) {
			hasError = true;
			errors[key] = error;
		} else if (value !== undefined) {
			result[key] = value;
		}
	}

	for (const key of derivedFields) {
		const prop = schema[key];
		let value = prop.derived({ ...row, ...object });
		let error;

		[error, value] = validateField(value, prop);

		if (error) {
			hasError = true;
			errors[key] = error;
		} else if (value !== undefined) {
			result[key] = value;
		}
	}

	if (hasError) {
		return [{ error: errors }, null];
	}

	return [null, result];
};

const typesHelpers = { stringToType, validateType };
self.APP.add(typesHelpers, { prop: "helpers" });
const Types = new Proxy({}, handler());
self.APP.add(Types, { library: "T" });

})();
await (async () => {
self.APP.add(
	{
		assets: new Map(),

		add(name, path, type) {
			this.assets.set(name, { path, type });
		},

		get(name) {
			const asset = this.assets.get(name);
			if (!asset) {
				console.warn(`Asset not found: ${name}`);
				return null;
			}
			if (self.APP.IS_DEV) {
				return `${self.APP.config.BASE_PATH}/${asset.path}`;
			}
			return `${asset.type}/${name}`;
		},

		getType(name) {
			const asset = this.assets.get(name);
			return asset ? asset.type : null;
		},

		remove(name) {
			const asset = this.assets.get(name);
			if (asset) {
				return this.assets.delete(name);
			}
			return false;
		},

		clear() {
			this.assets.clear();
		},

		getAll() {
			return Array.from(this.assets.entries()).map(
				([name, { path, type }]) => ({
					name,
					path,
					type,
				}),
			);
		},
	},
	{ library: "Assets" },
);

})();
await (async () => {
const serialize = (value) => {
	if (typeof value === "object" || Array.isArray(value)) {
		return JSON.stringify(value);
	}
	return value;
};

const deserialize = (value) => {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};

const get = (storage) => (key) => {
	const value = storage.getItem(key);
	return value !== null ? deserialize(value) : null;
};

const set = (storage) => (key, value) => {
	storage.setItem(key, serialize(value));
	return { key };
};

const remove = (storage) => (key) => {
	storage.removeItem(key);
	return { key };
};

const has = (storage) => (key) => {
	return storage.getItem(key) !== null && storage.getItem(key) !== undefined;
};

const createStorageAdapter = (storage) => {
	return {
		has: has(storage),
		set: set(storage),
		remove: remove(storage),
		get: get(storage),
	};
};

const local = createStorageAdapter(window.localStorage);
const session = createStorageAdapter(window.sessionStorage);

self.APP.add({ local, session }, { prop: "adapters" });

})();
await (async () => {
const getHashParams = () => {
	const hash = window.location.hash.substring(1);
	return new URLSearchParams(hash);
};

const setHashParams = (params) => {
	const newHash = params.toString();
	window.location.hash = newHash;
};

const hash = {
	get: (key) => {
		const params = getHashParams();
		return params.get(key);
	},
	has: (key) => {
		const params = getHashParams();
		return params.has(key);
	},
	set: (key, value) => {
		const params = getHashParams();
		params.set(key, value);
		setHashParams(params);
		window.dispatchEvent(new Event("popstate"));
		return { key };
	},
	remove: (key) => {
		const params = getHashParams();
		params.delete(key);
		setHashParams(params);
		return { key };
	},
};

const querystring = {
	get(key) {
		const params = new URLSearchParams(window.location.search);
		return params.get(key);
	},

	set(key, value) {
		const params = new URLSearchParams(window.location.search);
		params.set(key, value);
		window.history?.pushState?.(
			{},
			"",
			`${window.location.pathname}?${params}`,
		);
		window.dispatchEvent(new Event("popstate"));
		return { key };
	},

	remove(key) {
		const params = new URLSearchParams(window.location.search);
		params.delete(key);
		window.history.pushState?.({}, "", `${window.location.pathname}?${params}`);
		return { key };
	},

	has(key) {
		const params = new URLSearchParams(window.location.search);
		return params.has(key);
	},
};

self.APP.add({ querystring, hash }, { prop: "adapters" });

})();
await (async () => {
const { APP } = self;
const ramStore = new Map();

const remove = (key) => {
	ramStore.delete(key);
	return { key };
};
const get = (key) => {
	return ramStore.get(key);
};
const has = (key) => {
	return ramStore.has(key);
};
const set = (key, value) => {
	ramStore.set(key, value);
	return { key };
};

const ram = {
	has,
	get,
	set,
	remove,
};

APP.add({ ram }, { prop: "adapters" });

const _syncInstances = {};
let SW;
const pendingRequests = {};
const handleSWMessage = async (event) => {
	const { eventId, type, payload } = event.data;
	const handler = APP.events[type];
	let response = payload;

	const respond =
		eventId &&
		((responsePayload) => {
			event.source.postMessage({
				eventId,
				payload: responsePayload,
			});
		});

	if (handler) {
		response = await handler({ respond, payload, eventId });
	}

	if (eventId && pendingRequests[eventId]) {
		try {
			pendingRequests[eventId].resolve(response);
		} catch (error) {
			pendingRequests[eventId].reject(new Error(error));
		} finally {
			delete pendingRequests[eventId];
		}
	} else {
		if (respond && response !== undefined) {
			respond(response);
		} else {
			// This is a new request from the service worker
			console.log("Handling new request from service worker:", event.data);
			event.source.postMessage({ eventId, type, payload: response });
		}
	}
};

const sendEvent = async (params) => {
	if (!SW?.active) {
		await initServiceWorker(params);
		setTimeout(() => {
			sendEvent(params);
		}, 100);
	} else SW.active.postMessage(params);
};

const initServiceWorker = async (firstMessage) => {
	if ("serviceWorker" in navigator) {
		try {
			const isExtension = !!self.chrome?.runtime?.id;

			if (!isExtension) {
				SW = await navigator.serviceWorker.register("serviceworker.js", {
					type: "classic",
				});
				console.log("Service Worker registered successfully:", SW);
			} else {
				SW = await navigator.serviceWorker.ready;
			}
			navigator.serviceWorker.addEventListener("message", handleSWMessage);

			if (!firstMessage) return;

			if (!SW.active) {
				await new Promise((resolve) => {
					const checkActive = setInterval(() => {
						if (SW.active) {
							clearInterval(checkActive);
							resolve();
						}
					}, 100);
				});
			}

			if (firstMessage) {
				SW.active.postMessage(firstMessage);
			}
		} catch (error) {
			console.error("Service worker registration failed:", error);
		}
	}
};

const sendRequest = (type, payload) => {
	const eventId =
		Date.now().toString() + Math.random().toString(36).substr(2, 9);
	return new Promise((resolve, reject) => {
		pendingRequests[eventId] = { resolve, reject };
		console.log({ type, payload, eventId });
		sendEvent({ type, payload, eventId });
	});
};

const backend = async (type, payload = {}) => {
	const response = await sendRequest(type, payload);
	return response;
};

backend.requestDataSync = (model, id) => {
	const instances = _syncInstances[model];
	if (instances) {
		for (const instance of instances) {
			instance.requestDataSync(model, id);
		}
	}
};

const createAdapter = (store, storeName) => {
	const onchange = [];

	const adapter = (key, value) => {
		if (value !== undefined) {
			return adapter.set(key, value);
		}
		return adapter.get(key);
	};

	adapter.get = (_key) => {
		let key = _key;
		let filter = null;
		if (_key.includes(":")) {
			[key, filter] = _key.split(":");
		}
		let storedValue = store.get(key);
		if (storedValue === null || storedValue === undefined) return null;
		if (filter) {
			if (Array.isArray(storedValue)) {
				storedValue = storedValue.find((v) => v[filter] === true);
			} else {
				storedValue = storedValue[filter];
			}
		}

		return {
			value: storedValue,
			set: (newValue) => adapter.set(key, newValue),
			remove: () => adapter.remove(key),
		};
	};

	adapter.set = (_key, _value) => {
		let key = _key;
		let value = _value;
		let filter = null;
		if (_key.includes(":")) {
			[key, filter] = _key.split(":");
		}
		if (filter) {
			const oldValue = store.get(key);
			if (Array.isArray(oldValue)) {
				value = oldValue.map((v) => ({ ...v, [filter]: v === _value }));
			} else {
				value = { ...oldValue, [filter]: value[filter] };
			}
		}
		store.set(key, value);
		window.dispatchEvent(
			new CustomEvent(`${storeName}StorageChange`, { detail: { key, value } }),
		);
		triggerListeners(key, value);
		return { key };
	};

	adapter.remove = (key) => {
		store.removeItem(key);
		window.dispatchEvent(
			new CustomEvent(`${storeName}StorageChange`, { detail: { key } }),
		);
		triggerListeners(key, null);
		return { key };
	};

	adapter.onchange = onchange;

	const triggerListeners = (key, value) => {
		onchange.forEach((callback) => callback(key, value, { Controller }));
	};

	return adapter;
};

const adapterCache = new Map();

const Controller = new Proxy(
	{
		backend,
		_syncInstances,
		SW,
	},
	{
		get(target, prop, receiver) {
			if (prop in target) {
				return Reflect.get(target, prop, receiver);
			}
			if (adapterCache.has(prop)) {
				return adapterCache.get(prop);
			}
			if (prop in self.APP.adapters) {
				const adapter = createAdapter(self.APP.adapters[prop], prop);
				adapterCache.set(prop, adapter);
				return adapter;
			}

			return undefined;
		},
	},
);

const events = {
	REQUEST_DATA_SYNC: async ({ payload }) => {
		const { model, id } = payload;
		Controller.backend.requestDataSync(model, id);
	},
	INIT_RESPONSE: async ({ payload }) => {
		const { ram } = Controller;
		const { user, app, device, clientId } = payload;
		app.started = true;
		ram.set("__app", app);
		ram.set("__user", user);
		ram.set("__device", device);
		ram.set("__clientId", clientId);
	},
};

const init = () => {
	initServiceWorker().then(() => {
		sendRequest("INIT");
	});
};

APP.add([init], { prop: "init" });
APP.add(events, { prop: "events" });
APP.add(Controller, { library: "Controller" });

})();
await (async () => {

})();
await (async () => {
const createBackendMethod = (action, modelName, opts = {}) => {
	return self.APP.Controller.backend(action, {
		model: modelName,
		...opts,
	});
};

const handleDynamicPropertyMethod = (
	modelName,
	model,
	action,
	property,
	value,
	row = null,
) => {
	if (!(property.toLowerCase() in model)) {
		throw new Error(`Property ${property} not found in model ${modelName}`);
	}
	const opts = {
		filter: { [property.toLowerCase()]: value },
		...(row && { row }),
	};
	return createBackendMethod(action, modelName, { opts });
};

const Model = new Proxy(
	{},
	{
		get(target, modelName) {
			const { models } = self.APP;
			if (!(modelName in models)) {
				throw new Error(`Model ${modelName} does not exist in models`);
			}
			const model = models[modelName];
			return new Proxy(
				{},
				{
					get(target, methodName) {
						const methodHandlers = {
							get: (id) =>
								createBackendMethod(
									id ? "GET" : "GET_MANY",
									modelName,
									id ? { id } : {},
								),
							getAll: () => createBackendMethod("GET_MANY", modelName),
							add: (row) => createBackendMethod("ADD", modelName, { row }),
							addMany: (rows) =>
								createBackendMethod("ADD_MANY", modelName, { rows }),
							remove: (id) => createBackendMethod("REMOVE", modelName, { id }),
							removeAll: (filter) =>
								createBackendMethod("REMOVE_MANY", modelName, {
									opts: { filter },
								}),
							edit: (row) => createBackendMethod("EDIT", modelName, { row }),
							editAll: (filter, rows) =>
								createBackendMethod("EDIT_MANY", modelName, {
									opts: { filter, rows },
								}),
							getBy: (property, value, row = null) =>
								handleDynamicPropertyMethod(
									modelName,
									model,
									"GET_MANY",
									property,
									value,
									row,
								),
							getAllBy: (property, value, row = null) =>
								handleDynamicPropertyMethod(
									modelName,
									model,
									"GET_MANY",
									property,
									value,
									row,
								),
							editAllBy: (property, value, row) =>
								handleDynamicPropertyMethod(
									modelName,
									model,
									"EDIT_MANY",
									property,
									value,
									row,
								),
							removeAllBy: (property, value) =>
								handleDynamicPropertyMethod(
									modelName,
									model,
									"REMOVE_MANY",
									property,
									value,
								),
						};

						if (methodName in methodHandlers) {
							return methodHandlers[methodName];
						}

						const dynamicMethods = [
							{ prefix: "getBy", action: "GET_MANY", length: 5 },
							{ prefix: "getAllBy", action: "GET_MANY", length: 8 },
							{ prefix: "editAllBy", action: "EDIT_MANY", length: 10 },
							{ prefix: "removeAllBy", action: "REMOVE_MANY", length: 12 },
						];

						for (const { prefix, action, length } of dynamicMethods) {
							if (methodName.startsWith(prefix) && methodName.length > length) {
								const property = methodName.slice(length);
								return (value, row = null) =>
									handleDynamicPropertyMethod(
										modelName,
										model,
										action,
										property,
										value,
										row,
									);
							}
						}

						throw new Error(
							`Method ${methodName} not found in model ${modelName}`,
						);
					},
				},
			);
		},
	},
);

self.APP.add(Model, { library: "Model" });

})();
await (async () => {
const DEV_MODE = false;
const ENABLE_EXTRA_SECURITY_HOOKS = true;
const ENABLE_SHADYDOM_NOPATCH = true;
const NODE_MODE = false;

// Allows minifiers to rename references to globalThis
const global = globalThis;

/**
 * Contains types that are part of the unstable debug API.
 *
 * Everything in this API is not stable and may change or be removed in the future,
 * even on patch releases.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
let LitUnstable;
/**
 * Useful for visualizing and logging insights into what the Lit template system is doing.
 *
 * Compiled out of prod mode builds.
 */
const debugLogEvent = DEV_MODE
	? (event) => {
			const shouldEmit = global.emitLitDebugLogEvents;
			if (!shouldEmit) {
				return;
			}
			global.dispatchEvent(
				new CustomEvent("lit-debug", {
					detail: event,
				}),
			);
		}
	: undefined;
// Used for connecting beginRender and endRender events when there are nested
// renders when errors are thrown preventing an endRender event from being
// called.
let debugLogRenderId = 0;
let issueWarning;
if (DEV_MODE) {
	global.litIssuedWarnings ??= new Set();

	// Issue a warning, if we haven't already.
	issueWarning = (code, warning) => {
		warning += code
			? ` See https://lit.dev/msg/${code} for more information.`
			: "";
		if (!global.litIssuedWarnings.has(warning)) {
			console.warn(warning);
			global.litIssuedWarnings.add(warning);
		}
	};
	issueWarning(
		"dev-mode",
		`Lit is in dev mode. Not recommended for production!`,
	);
}
const wrap =
	ENABLE_SHADYDOM_NOPATCH &&
	global.ShadyDOM?.inUse &&
	global.ShadyDOM?.noPatch === true
		? global.ShadyDOM.wrap
		: (node) => node;
const trustedTypes = global.trustedTypes;

/**
 * Our TrustedTypePolicy for HTML which is declared using the html template
 * tag function.
 *
 * That HTML is a developer-authored constant, and is parsed with innerHTML
 * before any untrusted expressions have been mixed in. Therefor it is
 * considered safe by construction.
 */
const policy = trustedTypes
	? trustedTypes.createPolicy("lit-html", {
			createHTML: (s) => s,
		})
	: undefined;

/**
 * Used to sanitize any value before it is written into the DOM. This can be
 * used to implement a security policy of allowed and disallowed values in
 * order to prevent XSS attacks.
 *
 * One way of using this callback would be to check attributes and properties
 * against a list of high risk fields, and require that values written to such
 * fields be instances of a class which is safe by construction. Closure's Safe
 * HTML Types is one implementation of this technique (
 * https://github.com/google/safe-html-types/blob/master/doc/safehtml-types.md).
 * The TrustedTypes polyfill in API-only mode could also be used as a basis
 * for this technique (https://github.com/WICG/trusted-types).
 *
 * @param node The HTML node (usually either a #text node or an Element) that
 *     is being written to. Note that this is just an exemplar node, the write
 *     may take place against another instance of the same class of node.
 * @param name The name of an attribute or property (for example, 'href').
 * @param type Indicates whether the write that's about to be performed will
 *     be to a property or a node.
 * @return A function that will sanitize this class of writes.
 */

/**
 * A function which can sanitize values that will be written to a specific kind
 * of DOM sink.
 *
 * See SanitizerFactory.
 *
 * @param value The value to sanitize. Will be the actual value passed into
 *     the lit-html template literal, so this could be of any type.
 * @return The value to write to the DOM. Usually the same as the input value,
 *     unless sanitization is needed.
 */

const identityFunction = (value) => value;
const noopSanitizer = (_node, _name, _type) => identityFunction;

/** Sets the global sanitizer factory. */
const setSanitizer = (newSanitizer) => {
	if (!ENABLE_EXTRA_SECURITY_HOOKS) {
		return;
	}
	if (sanitizerFactoryInternal !== noopSanitizer) {
		throw new Error(
			`Attempted to overwrite existing lit-html security policy.` +
				` setSanitizeDOMValueFactory should be called at most once.`,
		);
	}
	sanitizerFactoryInternal = newSanitizer;
};

/**
 * Only used in internal tests, not a part of the public API.
 */
const _testOnlyClearSanitizerFactoryDoNotCallOrElse = () => {
	sanitizerFactoryInternal = noopSanitizer;
};
const createSanitizer = (node, name, type) => {
	return sanitizerFactoryInternal(node, name, type);
};

// Added to an attribute name to mark the attribute as bound so we can find
// it easily.
const boundAttributeSuffix = "$lit$";

// This marker is used in many syntactic positions in HTML, so it must be
// a valid element name and attribute name. We don't support dynamic names (yet)
// but this at least ensures that the parse tree is closer to the template
// intention.
const marker = `lit$${Math.random().toFixed(9).slice(2)}$`;

// String used to tell if a comment is a marker comment
const markerMatch = "?" + marker;

// Text used to insert a comment marker node. We use processing instruction
// syntax because it's slightly smaller, but parses as a comment node.
const nodeMarker = `<${markerMatch}>`;
const d =
	NODE_MODE && global.document === undefined
		? {
				createTreeWalker() {
					return {};
				},
			}
		: document;

// Creates a dynamic marker. We never have to search for these in the DOM.
const createMarker = () => d.createComment("");

// https://tc39.github.io/ecma262/#sec-typeof-operator

const isPrimitive = (value) =>
	value === null || (typeof value != "object" && typeof value != "function");
const isArray = Array.isArray;
const isIterable = (value) =>
	isArray(value) ||
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	typeof value?.[Symbol.iterator] === "function";
const SPACE_CHAR = `[ \t\n\f\r]`;
const ATTR_VALUE_CHAR = `[^ \t\n\f\r"'\`<>=]`;
const NAME_CHAR = `[^\\s"'>=/]`;

// These regexes represent the five parsing states that we care about in the
// Template's HTML scanner. They match the *end* of the state they're named
// after.
// Depending on the match, we transition to a new state. If there's no match,
// we stay in the same state.
// Note that the regexes are stateful. We utilize lastIndex and sync it
// across the multiple regexes used. In addition to the five regexes below
// we also dynamically create a regex to find the matching end tags for raw
// text elements.

/**
 * End of text is: `<` followed by:
 *   (comment start) or (tag) or (dynamic tag binding)
 */
const textEndRegex = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
const COMMENT_START = 1;
const TAG_NAME = 2;
const DYNAMIC_TAG_NAME = 3;
const commentEndRegex = /-->/g;
/**
 * Comments not started with <!--, like </{, can be ended by a single `>`
 */
const comment2EndRegex = />/g;

/**
 * The tagEnd regex matches the end of the "inside an opening" tag syntax
 * position. It either matches a `>`, an attribute-like sequence, or the end
 * of the string after a space (attribute-name position ending).
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
 *
 * " \t\n\f\r" are HTML space characters:
 * https://infra.spec.whatwg.org/#ascii-whitespace
 *
 * So an attribute is:
 *  * The name: any character except a whitespace character, ("), ('), ">",
 *    "=", or "/". Note: this is different from the HTML spec which also excludes control characters.
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
const tagEndRegex = new RegExp(
	`>|${SPACE_CHAR}(?:(${NAME_CHAR}+)(${SPACE_CHAR}*=${SPACE_CHAR}*(?:${ATTR_VALUE_CHAR}|("|')|))|$)`,
	"g",
);
const ENTIRE_MATCH = 0;
const ATTRIBUTE_NAME = 1;
const SPACES_AND_EQUALS = 2;
const QUOTE_CHAR = 3;
const singleQuoteAttrEndRegex = /'/g;
const doubleQuoteAttrEndRegex = /"/g;
/**
 * Matches the raw text elements.
 *
 * Comments are not parsed within raw text elements, so we need to search their
 * text content for marker strings.
 */
const rawTextElement = /^(?:script|style|textarea|title)$/i;

/** TemplateResult types */
const HTML_RESULT = 1;
const SVG_RESULT = 2;
const MATHML_RESULT = 3;
// TemplatePart types
// IMPORTANT: these must match the values in PartType
const ATTRIBUTE_PART = 1;
const CHILD_PART = 2;
const PROPERTY_PART = 3;
const BOOLEAN_ATTRIBUTE_PART = 4;
const EVENT_PART = 5;
const ELEMENT_PART = 6;
const COMMENT_PART = 7;

/**
 * The return type of the template tag functions, {@linkcode html} and
 * {@linkcode svg} when it hasn't been compiled by @lit-labs/compiler.
 *
 * A `TemplateResult` object holds all the information about a template
 * expression required to render it: the template strings, expression values,
 * and type of template (html or svg).
 *
 * `TemplateResult` objects do not create any DOM on their own. To create or
 * update DOM you need to render the `TemplateResult`. See
 * [Rendering](https://lit.dev/docs/components/rendering) for more information.
 *
 */

/**
 * This is a template result that may be either uncompiled or compiled.
 *
 * In the future, TemplateResult will be this type. If you want to explicitly
 * note that a template result is potentially compiled, you can reference this
 * type and it will continue to behave the same through the next major version
 * of Lit. This can be useful for code that wants to prepare for the next
 * major version of Lit.
 */

/**
 * The return type of the template tag functions, {@linkcode html} and
 * {@linkcode svg}.
 *
 * A `TemplateResult` object holds all the information about a template
 * expression required to render it: the template strings, expression values,
 * and type of template (html or svg).
 *
 * `TemplateResult` objects do not create any DOM on their own. To create or
 * update DOM you need to render the `TemplateResult`. See
 * [Rendering](https://lit.dev/docs/components/rendering) for more information.
 *
 * In Lit 4, this type will be an alias of
 * MaybeCompiledTemplateResult, so that code will get type errors if it assumes
 * that Lit templates are not compiled. When deliberately working with only
 * one, use either {@linkcode CompiledTemplateResult} or
 * {@linkcode UncompiledTemplateResult} explicitly.
 */

/**
 * A TemplateResult that has been compiled by @lit-labs/compiler, skipping the
 * prepare step.
 */

/**
 * Generates a template literal tag function that returns a TemplateResult with
 * the given result type.
 */
const tag =
	(type) =>
	(strings, ...values) => {
		// Warn against templates octal escape sequences
		// We do this here rather than in render so that the warning is closer to the
		// template definition.
		if (DEV_MODE && strings.some((s) => s === undefined)) {
			console.warn(
				"Some template strings are undefined.\n" +
					"This is probably caused by illegal octal escape sequences.",
			);
		}
		if (DEV_MODE) {
			// Import static-html.js results in a circular dependency which g3 doesn't
			// handle. Instead we know that static values must have the field
			// `_$litStatic$`.
			if (values.some((val) => val?.["_$litStatic$"])) {
				issueWarning(
					"",
					`Static values 'literal' or 'unsafeStatic' cannot be used as values to non-static templates.\n` +
						`Please use the static 'html' tag function. See https://lit.dev/docs/templates/expressions/#static-expressions`,
				);
			}
		}
		return {
			// This property needs to remain unminified.
			["_$litType$"]: type,
			strings,
			values,
		};
	};

/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 *
 * ```ts
 * const header = (title: string) => html`<h1>${title}</h1>`;
 * ```
 *
 * The `html` tag returns a description of the DOM to render as a value. It is
 * lazy, meaning no work is done until the template is rendered. When rendering,
 * if a template comes from the same expression as a previously rendered result,
 * it's efficiently updated instead of replaced.
 */
const html = tag(HTML_RESULT);

/**
 * Interprets a template literal as an SVG fragment that can efficiently render
 * to and update a container.
 *
 * ```ts
 * const rect = svg`<rect width="10" height="10"></rect>`;
 *
 * const myImage = html`
 *   <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
 *     ${rect}
 *   </svg>`;
 * ```
 *
 * The `svg` *tag function* should only be used for SVG fragments, or elements
 * that would be contained **inside** an `<svg>` HTML element. A common error is
 * placing an `<svg>` *element* in a template tagged with the `svg` tag
 * function. The `<svg>` element is an HTML element and should be used within a
 * template tagged with the {@linkcode html} tag function.
 *
 * In LitElement usage, it's invalid to return an SVG fragment from the
 * `render()` method, as the SVG fragment will be contained within the element's
 * shadow root and thus not be properly contained within an `<svg>` HTML
 * element.
 */
const svg = tag(SVG_RESULT);

/**
 * Interprets a template literal as MathML fragment that can efficiently render
 * to and update a container.
 *
 * ```ts
 * const num = mathml`<mn>1</mn>`;
 *
 * const eq = html`
 *   <math>
 *     ${num}
 *   </math>`;
 * ```
 *
 * The `mathml` *tag function* should only be used for MathML fragments, or
 * elements that would be contained **inside** a `<math>` HTML element. A common
 * error is placing a `<math>` *element* in a template tagged with the `mathml`
 * tag function. The `<math>` element is an HTML element and should be used
 * within a template tagged with the {@linkcode html} tag function.
 *
 * In LitElement usage, it's invalid to return an MathML fragment from the
 * `render()` method, as the MathML fragment will be contained within the
 * element's shadow root and thus not be properly contained within a `<math>`
 * HTML element.
 */
const mathml = tag(MATHML_RESULT);

/**
 * A sentinel value that signals that a value was handled by a directive and
 * should not be written to the DOM.
 */
const noChange = Symbol.for("lit-noChange");

/**
 * A sentinel value that signals a ChildPart to fully clear its content.
 *
 * ```ts
 * const button = html`${
 *  user.isAdmin
 *    ? html`<button>DELETE</button>`
 *    : nothing
 * }`;
 * ```
 *
 * Prefer using `nothing` over other falsy values as it provides a consistent
 * behavior between various expression binding contexts.
 *
 * In child expressions, `undefined`, `null`, `''`, and `nothing` all behave the
 * same and render no nodes. In attribute expressions, `nothing` _removes_ the
 * attribute, while `undefined` and `null` will render an empty string. In
 * property expressions `nothing` becomes `undefined`.
 */
const nothing = Symbol.for("lit-nothing");

/**
 * The cache of prepared templates, keyed by the tagged TemplateStringsArray
 * and _not_ accounting for the specific template tag used. This means that
 * template tags cannot be dynamic - they must statically be one of html, svg,
 * or attr. This restriction simplifies the cache lookup, which is on the hot
 * path for rendering.
 */
const templateCache = new WeakMap();

/**
 * Object specifying options for controlling lit-html rendering. Note that
 * while `render` may be called multiple times on the same `container` (and
 * `renderBefore` reference node) to efficiently update the rendered content,
 * only the options passed in during the first render are respected during
 * the lifetime of renders to that unique `container` + `renderBefore`
 * combination.
 */

const walker = d.createTreeWalker(
	d,
	129 /* NodeFilter.SHOW_{ELEMENT|COMMENT} */,
);
let sanitizerFactoryInternal = noopSanitizer;

//
// Classes only below here, const variable declarations only above here...
//
// Keeping variable declarations and classes together improves minification.
// Interfaces and type aliases can be interleaved freely.
//

// Type for classes that have a `_directive` or `_directives[]` field, used by
// `resolveDirective`

function trustFromTemplateString(tsa, stringFromTSA) {
	// A security check to prevent spoofing of Lit template results.
	// In the future, we may be able to replace this with Array.isTemplateObject,
	// though we might need to make that check inside of the html and svg
	// functions, because precompiled templates don't come in as
	// TemplateStringArray objects.
	if (!isArray(tsa) || !tsa.hasOwnProperty("raw")) {
		let message = "invalid template strings array";
		if (DEV_MODE) {
			message = `
          Internal Error: expected template strings to be an array
          with a 'raw' field. Faking a template strings array by
          calling html or svg like an ordinary function is effectively
          the same as calling unsafeHtml and can lead to major security
          issues, e.g. opening your code up to XSS attacks.
          If you're using the html or svg tagged template functions normally
          and still seeing this error, please file a bug at
          https://github.com/lit/lit/issues/new?template=bug_report.md
          and include information about your build tooling, if any.
        `
				.trim()
				.replace(/\n */g, "\n");
		}
		throw new Error(message);
	}
	return policy !== undefined
		? policy.createHTML(stringFromTSA)
		: stringFromTSA;
}

/**
 * Returns an HTML string for the given TemplateStringsArray and result type
 * (HTML or SVG), along with the case-sensitive bound attribute names in
 * template order. The HTML contains comment markers denoting the `ChildPart`s
 * and suffixes on bound attributes denoting the `AttributeParts`.
 *
 * @param strings template strings array
 * @param type HTML or SVG
 * @return Array containing `[html, attrNames]` (array returned for terseness,
 *     to avoid object fields since this code is shared with non-minified SSR
 *     code)
 */
const getTemplateHtml = (strings, type) => {
	// Insert makers into the template HTML to represent the position of
	// bindings. The following code scans the template strings to determine the
	// syntactic position of the bindings. They can be in text position, where
	// we insert an HTML comment, attribute value position, where we insert a
	// sentinel string and re-write the attribute name, or inside a tag where
	// we insert the sentinel string.
	const l = strings.length - 1;
	// Stores the case-sensitive bound attribute names in the order of their
	// parts. ElementParts are also reflected in this array as undefined
	// rather than a string, to disambiguate from attribute bindings.
	const attrNames = [];
	let html =
		type === SVG_RESULT ? "<svg>" : type === MATHML_RESULT ? "<math>" : "";

	// When we're inside a raw text tag (not it's text content), the regex
	// will still be tagRegex so we can find attributes, but will switch to
	// this regex when the tag ends.
	let rawTextEndRegex;

	// The current parsing state, represented as a reference to one of the
	// regexes
	let regex = textEndRegex;
	for (let i = 0; i < l; i++) {
		const s = strings[i];
		// The index of the end of the last attribute name. When this is
		// positive at end of a string, it means we're in an attribute value
		// position and need to rewrite the attribute name.
		// We also use a special value of -2 to indicate that we encountered
		// the end of a string in attribute name position.
		let attrNameEndIndex = -1;
		let attrName;
		let lastIndex = 0;
		let match;

		// The conditions in this loop handle the current parse state, and the
		// assignments to the `regex` variable are the state transitions.
		while (lastIndex < s.length) {
			// Make sure we start searching from where we previously left off
			regex.lastIndex = lastIndex;
			match = regex.exec(s);
			if (match === null) {
				break;
			}
			lastIndex = regex.lastIndex;
			if (regex === textEndRegex) {
				if (match[COMMENT_START] === "!--") {
					regex = commentEndRegex;
				} else if (match[COMMENT_START] !== undefined) {
					// We started a weird comment, like </{
					regex = comment2EndRegex;
				} else if (match[TAG_NAME] !== undefined) {
					if (rawTextElement.test(match[TAG_NAME])) {
						// Record if we encounter a raw-text element. We'll switch to
						// this regex at the end of the tag.
						rawTextEndRegex = new RegExp(`</${match[TAG_NAME]}`, "g");
					}
					regex = tagEndRegex;
				} else if (match[DYNAMIC_TAG_NAME] !== undefined) {
					if (DEV_MODE) {
						throw new Error(
							"Bindings in tag names are not supported. Please use static templates instead. " +
								"See https://lit.dev/docs/templates/expressions/#static-expressions",
						);
					}
					regex = tagEndRegex;
				}
			} else if (regex === tagEndRegex) {
				if (match[ENTIRE_MATCH] === ">") {
					// End of a tag. If we had started a raw-text element, use that
					// regex
					regex = rawTextEndRegex ?? textEndRegex;
					// We may be ending an unquoted attribute value, so make sure we
					// clear any pending attrNameEndIndex
					attrNameEndIndex = -1;
				} else if (match[ATTRIBUTE_NAME] === undefined) {
					// Attribute name position
					attrNameEndIndex = -2;
				} else {
					attrNameEndIndex = regex.lastIndex - match[SPACES_AND_EQUALS].length;
					attrName = match[ATTRIBUTE_NAME];
					regex =
						match[QUOTE_CHAR] === undefined
							? tagEndRegex
							: match[QUOTE_CHAR] === '"'
								? doubleQuoteAttrEndRegex
								: singleQuoteAttrEndRegex;
				}
			} else if (
				regex === doubleQuoteAttrEndRegex ||
				regex === singleQuoteAttrEndRegex
			) {
				regex = tagEndRegex;
			} else if (regex === commentEndRegex || regex === comment2EndRegex) {
				regex = textEndRegex;
			} else {
				// Not one of the five state regexes, so it must be the dynamically
				// created raw text regex and we're at the close of that element.
				regex = tagEndRegex;
				rawTextEndRegex = undefined;
			}
		}
		if (DEV_MODE) {
			// If we have a attrNameEndIndex, which indicates that we should
			// rewrite the attribute name, assert that we're in a valid attribute
			// position - either in a tag, or a quoted attribute value.
			console.assert(
				attrNameEndIndex === -1 ||
					regex === tagEndRegex ||
					regex === singleQuoteAttrEndRegex ||
					regex === doubleQuoteAttrEndRegex,
				"unexpected parse state B",
			);
		}

		// We have four cases:
		//  1. We're in text position, and not in a raw text element
		//     (regex === textEndRegex): insert a comment marker.
		//  2. We have a non-negative attrNameEndIndex which means we need to
		//     rewrite the attribute name to add a bound attribute suffix.
		//  3. We're at the non-first binding in a multi-binding attribute, use a
		//     plain marker.
		//  4. We're somewhere else inside the tag. If we're in attribute name
		//     position (attrNameEndIndex === -2), add a sequential suffix to
		//     generate a unique attribute name.

		// Detect a binding next to self-closing tag end and insert a space to
		// separate the marker from the tag end:
		const end =
			regex === tagEndRegex && strings[i + 1].startsWith("/>") ? " " : "";
		html +=
			regex === textEndRegex
				? s + nodeMarker
				: attrNameEndIndex >= 0
					? (attrNames.push(attrName),
						s.slice(0, attrNameEndIndex) +
							boundAttributeSuffix +
							s.slice(attrNameEndIndex)) +
						marker +
						end
					: s + marker + (attrNameEndIndex === -2 ? i : end);
	}
	const htmlResult =
		html +
		(strings[l] || "<?>") +
		(type === SVG_RESULT ? "</svg>" : type === MATHML_RESULT ? "</math>" : "");

	// Returned as an array for terseness
	return [trustFromTemplateString(strings, htmlResult), attrNames];
};

/** @internal */

class Template {
	/** @internal */

	parts = [];
	constructor(
		// This property needs to remain unminified.
		{ strings, ["_$litType$"]: type },
		options,
	) {
		let node;
		let nodeIndex = 0;
		let attrNameIndex = 0;
		const partCount = strings.length - 1;
		const parts = this.parts;

		// Create template element
		const [html, attrNames] = getTemplateHtml(strings, type);
		this.el = Template.createElement(html, options);
		walker.currentNode = this.el.content;

		// Re-parent SVG or MathML nodes into template root
		if (type === SVG_RESULT || type === MATHML_RESULT) {
			const wrapper = this.el.content.firstChild;
			wrapper.replaceWith(...wrapper.childNodes);
		}

		// Walk the template to find binding markers and create TemplateParts
		while ((node = walker.nextNode()) !== null && parts.length < partCount) {
			if (node.nodeType === 1) {
				if (DEV_MODE) {
					const tag = node.localName;
					// Warn if `textarea` includes an expression and throw if `template`
					// does since these are not supported. We do this by checking
					// innerHTML for anything that looks like a marker. This catches
					// cases like bindings in textarea there markers turn into text nodes.
					if (
						/^(?:textarea|template)$/i.test(tag) &&
						node.innerHTML.includes(marker)
					) {
						const m =
							`Expressions are not supported inside \`${tag}\` ` +
							`elements. See https://lit.dev/msg/expression-in-${tag} for more ` +
							`information.`;
						if (tag === "template") {
							throw new Error(m);
						} else issueWarning("", m);
					}
				}
				// TODO (justinfagnani): for attempted dynamic tag names, we don't
				// increment the bindingIndex, and it'll be off by 1 in the element
				// and off by two after it.
				if (node.hasAttributes()) {
					for (const name of node.getAttributeNames()) {
						if (name.endsWith(boundAttributeSuffix)) {
							const realName = attrNames[attrNameIndex++];
							const value = node.getAttribute(name);
							const statics = value.split(marker);
							const m = /([.?@])?(.*)/.exec(realName);
							parts.push({
								type: ATTRIBUTE_PART,
								index: nodeIndex,
								name: m[2],
								strings: statics,
								ctor:
									m[1] === "."
										? PropertyPart
										: m[1] === "?"
											? BooleanAttributePart
											: m[1] === "@"
												? EventPart
												: AttributePart,
							});
							node.removeAttribute(name);
						} else if (name.startsWith(marker)) {
							parts.push({
								type: ELEMENT_PART,
								index: nodeIndex,
							});
							node.removeAttribute(name);
						}
					}
				}
				// TODO (justinfagnani): benchmark the regex against testing for each
				// of the 3 raw text element names.
				if (rawTextElement.test(node.tagName)) {
					// For raw text elements we need to split the text content on
					// markers, create a Text node for each segment, and create
					// a TemplatePart for each marker.
					const strings = node.textContent.split(marker);
					const lastIndex = strings.length - 1;
					if (lastIndex > 0) {
						node.textContent = trustedTypes ? trustedTypes.emptyScript : "";
						// Generate a new text node for each literal section
						// These nodes are also used as the markers for node parts
						// We can't use empty text nodes as markers because they're
						// normalized when cloning in IE (could simplify when
						// IE is no longer supported)
						for (let i = 0; i < lastIndex; i++) {
							node.append(strings[i], createMarker());
							// Walk past the marker node we just added
							walker.nextNode();
							parts.push({
								type: CHILD_PART,
								index: ++nodeIndex,
							});
						}
						// Note because this marker is added after the walker's current
						// node, it will be walked to in the outer loop (and ignored), so
						// we don't need to adjust nodeIndex here
						node.append(strings[lastIndex], createMarker());
					}
				}
			} else if (node.nodeType === 8) {
				const data = node.data;
				if (data === markerMatch) {
					parts.push({
						type: CHILD_PART,
						index: nodeIndex,
					});
				} else {
					let i = -1;
					while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
						// Comment node has a binding marker inside, make an inactive part
						// The binding won't work, but subsequent bindings will
						parts.push({
							type: COMMENT_PART,
							index: nodeIndex,
						});
						// Move to the end of the match
						i += marker.length - 1;
					}
				}
			}
			nodeIndex++;
		}
		if (DEV_MODE) {
			// If there was a duplicate attribute on a tag, then when the tag is
			// parsed into an element the attribute gets de-duplicated. We can detect
			// this mismatch if we haven't precisely consumed every attribute name
			// when preparing the template. This works because `attrNames` is built
			// from the template string and `attrNameIndex` comes from processing the
			// resulting DOM.
			if (attrNames.length !== attrNameIndex) {
				throw new Error(
					`Detected duplicate attribute bindings. This occurs if your template ` +
						`has duplicate attributes on an element tag. For example ` +
						`"<input ?disabled=\${true} ?disabled=\${false}>" contains a ` +
						`duplicate "disabled" attribute. The error was detected in ` +
						`the following template: \n` +
						"`" +
						strings.join("${...}") +
						"`",
				);
			}
		}

		// We could set walker.currentNode to another node here to prevent a memory
		// leak, but every time we prepare a template, we immediately render it
		// and re-use the walker in new TemplateInstance._clone().
		debugLogEvent?.({
			kind: "template prep",
			template: this,
			clonableTemplate: this.el,
			parts: this.parts,
			strings,
		});
	}

	// Overridden via `litHtmlPolyfillSupport` to provide platform support.
	/** @nocollapse */
	static createElement(html, _options) {
		const el = d.createElement("template");
		el.innerHTML = html;
		return el;
	}
}
function resolveDirective(part, value, parent = part, attributeIndex) {
	// Bail early if the value is explicitly noChange. Note, this means any
	// nested directive is still attached and is not run.
	if (value === noChange || value === nothing) {
		return value;
	}

	let currentDirective =
		attributeIndex !== undefined
			? parent.__directives?.[attributeIndex]
			: parent.__directive;
	const nextDirectiveConstructor = isPrimitive(value)
		? undefined
		: // This property needs to remain unminified.
			value["_$litDirective$"];
	if (currentDirective?.constructor !== nextDirectiveConstructor) {
		// This property needs to remain unminified.
		currentDirective?.["_$notifyDirectiveConnectionChanged"]?.(false);
		if (nextDirectiveConstructor === undefined) {
			currentDirective = undefined;
		} else {
			currentDirective = new nextDirectiveConstructor(part);
			currentDirective?._$initialize(part, parent, attributeIndex);
		}
		if (attributeIndex !== undefined) {
			(parent.__directives ??= [])[attributeIndex] = currentDirective;
		} else {
			parent.__directive = currentDirective;
		}
	}
	if (currentDirective !== undefined) {
		value = resolveDirective(
			part,
			currentDirective._$resolve(part, value.values),
			currentDirective,
			attributeIndex,
		);
	}
	return value;
}
/**
 * An updateable instance of a Template. Holds references to the Parts used to
 * update the template instance.
 */
class TemplateInstance {
	_$parts = [];

	/** @internal */

	/** @internal */
	_$disconnectableChildren = undefined;
	constructor(template, parent) {
		this._$template = template;
		this._$parent = parent;
	}

	// Called by ChildPart parentNode getter
	get parentNode() {
		return this._$parent.parentNode;
	}

	// See comment in Disconnectable interface for why this is a getter
	get _$isConnected() {
		return this._$parent._$isConnected;
	}

	// This method is separate from the constructor because we need to return a
	// DocumentFragment and we don't want to hold onto it with an instance field.
	_clone(options) {
		const {
			el: { content },
			parts,
		} = this._$template;
		const fragment = (options?.creationScope ?? d).importNode(content, true);
		walker.currentNode = fragment;
		let node = walker.nextNode();
		let nodeIndex = 0;
		let partIndex = 0;
		let templatePart = parts[0];
		while (templatePart !== undefined) {
			if (nodeIndex === templatePart.index) {
				let part;
				if (templatePart.type === CHILD_PART) {
					part = new ChildPart(node, node.nextSibling, this, options);
				} else if (templatePart.type === ATTRIBUTE_PART) {
					part = new templatePart.ctor(
						node,
						templatePart.name,
						templatePart.strings,
						this,
						options,
					);
				} else if (templatePart.type === ELEMENT_PART) {
					part = new ElementPart(node, this, options);
				}
				this._$parts.push(part);
				templatePart = parts[++partIndex];
			}
			if (nodeIndex !== templatePart?.index) {
				node = walker.nextNode();
				nodeIndex++;
			}
		}
		// We need to set the currentNode away from the cloned tree so that we
		// don't hold onto the tree even if the tree is detached and should be
		// freed.
		walker.currentNode = d;
		return fragment;
	}
	_update(values) {
		let i = 0;
		for (const part of this._$parts) {
			if (part !== undefined) {
				debugLogEvent?.({
					kind: "set part",
					part,
					value: values[i],
					valueIndex: i,
					values,
					templateInstance: this,
				});
				if (part.strings !== undefined) {
					part._$setValue(values, part, i);
					// The number of values the part consumes is part.strings.length - 1
					// since values are in between template spans. We increment i by 1
					// later in the loop, so increment it by part.strings.length - 2 here
					i += part.strings.length - 2;
				} else {
					part._$setValue(values[i]);
				}
			}
			i++;
		}
	}
}

/*
 * Parts
 */

/**
 * A TemplatePart represents a dynamic part in a template, before the template
 * is instantiated. When a template is instantiated Parts are created from
 * TemplateParts.
 */

class ChildPart {
	type = CHILD_PART;
	_$committedValue = nothing;
	/** @internal */

	/** @internal */

	/** @internal */

	/** @internal */

	/**
	 * Connection state for RootParts only (i.e. ChildPart without _$parent
	 * returned from top-level `render`). This field is unused otherwise. The
	 * intention would be clearer if we made `RootPart` a subclass of `ChildPart`
	 * with this field (and a different _$isConnected getter), but the subclass
	 * caused a perf regression, possibly due to making call sites polymorphic.
	 * @internal
	 */

	// See comment in Disconnectable interface for why this is a getter
	get _$isConnected() {
		// ChildParts that are not at the root should always be created with a
		// parent; only RootChildNode's won't, so they return the local isConnected
		// state
		return this._$parent?._$isConnected ?? this.__isConnected;
	}

	// The following fields will be patched onto ChildParts when required by
	// AsyncDirective
	/** @internal */
	_$disconnectableChildren = undefined;
	/** @internal */

	/** @internal */

	constructor(startNode, endNode, parent, options) {
		this._$startNode = startNode;
		this._$endNode = endNode;
		this._$parent = parent;
		this.options = options;
		// Note __isConnected is only ever accessed on RootParts (i.e. when there is
		// no _$parent); the value on a non-root-part is "don't care", but checking
		// for parent would be more code
		this.__isConnected = options?.isConnected ?? true;
		if (ENABLE_EXTRA_SECURITY_HOOKS) {
			// Explicitly initialize for consistent class shape.
			this._textSanitizer = undefined;
		}
	}

	/**
	 * The parent node into which the part renders its content.
	 *
	 * A ChildPart's content consists of a range of adjacent child nodes of
	 * `.parentNode`, possibly bordered by 'marker nodes' (`.startNode` and
	 * `.endNode`).
	 *
	 * - If both `.startNode` and `.endNode` are non-null, then the part's content
	 * consists of all siblings between `.startNode` and `.endNode`, exclusively.
	 *
	 * - If `.startNode` is non-null but `.endNode` is null, then the part's
	 * content consists of all siblings following `.startNode`, up to and
	 * including the last child of `.parentNode`. If `.endNode` is non-null, then
	 * `.startNode` will always be non-null.
	 *
	 * - If both `.endNode` and `.startNode` are null, then the part's content
	 * consists of all child nodes of `.parentNode`.
	 */
	get parentNode() {
		let parentNode = wrap(this._$startNode).parentNode;
		const parent = this._$parent;
		if (
			parent !== undefined &&
			parentNode?.nodeType === 11 /* Node.DOCUMENT_FRAGMENT */
		) {
			// If the parentNode is a DocumentFragment, it may be because the DOM is
			// still in the cloned fragment during initial render; if so, get the real
			// parentNode the part will be committed into by asking the parent.
			parentNode = parent.parentNode;
		}
		return parentNode;
	}

	/**
	 * The part's leading marker node, if any. See `.parentNode` for more
	 * information.
	 */
	get startNode() {
		return this._$startNode;
	}

	/**
	 * The part's trailing marker node, if any. See `.parentNode` for more
	 * information.
	 */
	get endNode() {
		return this._$endNode;
	}
	_$setValue(value, directiveParent = this) {
		if (DEV_MODE && this.parentNode === null) {
			throw new Error(
				`This \`ChildPart\` has no \`parentNode\` and therefore cannot accept a value. This likely means the element containing the part was manipulated in an unsupported way outside of Lit's control such that the part's marker nodes were ejected from DOM. For example, setting the element's \`innerHTML\` or \`textContent\` can do this.`,
			);
		}
		value = resolveDirective(this, value, directiveParent);
		if (isPrimitive(value)) {
			// Non-rendering child values. It's important that these do not render
			// empty text nodes to avoid issues with preventing default <slot>
			// fallback content.
			if (value === nothing || value == null || value === "") {
				if (this._$committedValue !== nothing) {
					debugLogEvent?.({
						kind: "commit nothing to child",
						start: this._$startNode,
						end: this._$endNode,
						parent: this._$parent,
						options: this.options,
					});
					this._$clear();
				}
				this._$committedValue = nothing;
			} else if (value !== this._$committedValue && value !== noChange) {
				this._commitText(value);
			}
			// This property needs to remain unminified.
		} else if (value["_$litType$"] !== undefined) {
			this._commitTemplateResult(value);
		} else if (value.nodeType !== undefined) {
			if (DEV_MODE && this.options?.host === value) {
				this._commitText(
					`[probable mistake: rendered a template's host in itself ` +
						`(commonly caused by writing \${this} in a template]`,
				);
				console.warn(
					`Attempted to render the template host`,
					value,
					`inside itself. This is almost always a mistake, and in dev mode `,
					`we render some warning text. In production however, we'll `,
					`render it, which will usually result in an error, and sometimes `,
					`in the element disappearing from the DOM.`,
				);
				return;
			}
			this._commitNode(value);
		} else if (isIterable(value)) {
			this._commitIterable(value);
		} else {
			// Fallback, will render the string representation
			this._commitText(value);
		}
	}
	_insert(node) {
		return wrap(wrap(this._$startNode).parentNode).insertBefore(
			node,
			this._$endNode,
		);
	}
	_commitNode(value) {
		if (this._$committedValue !== value) {
			this._$clear();
			if (
				ENABLE_EXTRA_SECURITY_HOOKS &&
				sanitizerFactoryInternal !== noopSanitizer
			) {
				const parentNodeName = this._$startNode.parentNode?.nodeName;
				if (parentNodeName === "STYLE" || parentNodeName === "SCRIPT") {
					let message = "Forbidden";
					if (DEV_MODE) {
						if (parentNodeName === "STYLE") {
							message =
								`Lit does not support binding inside style nodes. ` +
								`This is a security risk, as style injection attacks can ` +
								`exfiltrate data and spoof UIs. ` +
								`Consider instead using css\`...\` literals ` +
								`to compose styles, and do dynamic styling with ` +
								`css custom properties, ::parts, <slot>s, ` +
								`and by mutating the DOM rather than stylesheets.`;
						} else {
							message =
								`Lit does not support binding inside script nodes. ` +
								`This is a security risk, as it could allow arbitrary ` +
								`code execution.`;
						}
					}
					throw new Error(message);
				}
			}
			debugLogEvent?.({
				kind: "commit node",
				start: this._$startNode,
				parent: this._$parent,
				value: value,
				options: this.options,
			});
			this._$committedValue = this._insert(value);
		}
	}
	_commitText(value) {
		// If the committed value is a primitive it means we called _commitText on
		// the previous render, and we know that this._$startNode.nextSibling is a
		// Text node. We can now just replace the text content (.data) of the node.
		if (
			this._$committedValue !== nothing &&
			isPrimitive(this._$committedValue)
		) {
			const node = wrap(this._$startNode).nextSibling;
			if (ENABLE_EXTRA_SECURITY_HOOKS) {
				if (this._textSanitizer === undefined) {
					this._textSanitizer = createSanitizer(node, "data", "property");
				}
				value = this._textSanitizer(value);
			}
			debugLogEvent?.({
				kind: "commit text",
				node,
				value,
				options: this.options,
			});
			node.data = value;
		} else {
			if (ENABLE_EXTRA_SECURITY_HOOKS) {
				const textNode = d.createTextNode("");
				this._commitNode(textNode);
				// When setting text content, for security purposes it matters a lot
				// what the parent is. For example, <style> and <script> need to be
				// handled with care, while <span> does not. So first we need to put a
				// text node into the document, then we can sanitize its content.
				if (this._textSanitizer === undefined) {
					this._textSanitizer = createSanitizer(textNode, "data", "property");
				}
				value = this._textSanitizer(value);
				debugLogEvent?.({
					kind: "commit text",
					node: textNode,
					value,
					options: this.options,
				});
				textNode.data = value;
			} else {
				this._commitNode(d.createTextNode(value));
				debugLogEvent?.({
					kind: "commit text",
					node: wrap(this._$startNode).nextSibling,
					value,
					options: this.options,
				});
			}
		}
		this._$committedValue = value;
	}
	_commitTemplateResult(result) {
		// This property needs to remain unminified.
		const { values, ["_$litType$"]: type } = result;
		// If $litType$ is a number, result is a plain TemplateResult and we get
		// the template from the template cache. If not, result is a
		// CompiledTemplateResult and _$litType$ is a CompiledTemplate and we need
		// to create the <template> element the first time we see it.
		const template =
			typeof type === "number"
				? this._$getTemplate(result)
				: (type.el === undefined &&
						(type.el = Template.createElement(
							trustFromTemplateString(type.h, type.h[0]),
							this.options,
						)),
					type);
		if (this._$committedValue?._$template === template) {
			debugLogEvent?.({
				kind: "template updating",
				template,
				instance: this._$committedValue,
				parts: this._$committedValue._$parts,
				options: this.options,
				values,
			});
			this._$committedValue._update(values);
		} else {
			const instance = new TemplateInstance(template, this);
			const fragment = instance._clone(this.options);
			debugLogEvent?.({
				kind: "template instantiated",
				template,
				instance,
				parts: instance._$parts,
				options: this.options,
				fragment,
				values,
			});
			instance._update(values);
			debugLogEvent?.({
				kind: "template instantiated and updated",
				template,
				instance,
				parts: instance._$parts,
				options: this.options,
				fragment,
				values,
			});
			this._commitNode(fragment);
			this._$committedValue = instance;
		}
	}

	// Overridden via `litHtmlPolyfillSupport` to provide platform support.
	/** @internal */
	_$getTemplate(result) {
		let template = templateCache.get(result.strings);
		if (template === undefined) {
			templateCache.set(result.strings, (template = new Template(result)));
		}
		return template;
	}
	_commitIterable(value) {
		// For an Iterable, we create a new InstancePart per item, then set its
		// value to the item. This is a little bit of overhead for every item in
		// an Iterable, but it lets us recurse easily and efficiently update Arrays
		// of TemplateResults that will be commonly returned from expressions like:
		// array.map((i) => html`${i}`), by reusing existing TemplateInstances.

		// If value is an array, then the previous render was of an
		// iterable and value will contain the ChildParts from the previous
		// render. If value is not an array, clear this part and make a new
		// array for ChildParts.
		if (!isArray(this._$committedValue)) {
			this._$committedValue = [];
			this._$clear();
		}

		// Lets us keep track of how many items we stamped so we can clear leftover
		// items from a previous render
		const itemParts = this._$committedValue;
		let partIndex = 0;
		let itemPart;
		for (const item of value) {
			if (partIndex === itemParts.length) {
				// If no existing part, create a new one
				// TODO (justinfagnani): test perf impact of always creating two parts
				// instead of sharing parts between nodes
				// https://github.com/lit/lit/issues/1266
				itemParts.push(
					(itemPart = new ChildPart(
						this._insert(createMarker()),
						this._insert(createMarker()),
						this,
						this.options,
					)),
				);
			} else {
				// Reuse an existing part
				itemPart = itemParts[partIndex];
			}
			itemPart._$setValue(item);
			partIndex++;
		}
		if (partIndex < itemParts.length) {
			// itemParts always have end nodes
			this._$clear(itemPart && wrap(itemPart._$endNode).nextSibling, partIndex);
			// Truncate the parts array so _value reflects the current state
			itemParts.length = partIndex;
		}
	}

	/**
	 * Removes the nodes contained within this Part from the DOM.
	 *
	 * @param start Start node to clear from, for clearing a subset of the part's
	 *     DOM (used when truncating iterables)
	 * @param from  When `start` is specified, the index within the iterable from
	 *     which ChildParts are being removed, used for disconnecting directives in
	 *     those Parts.
	 *
	 * @internal
	 */
	_$clear(start = wrap(this._$startNode).nextSibling, from) {
		this._$notifyConnectionChanged?.(false, true, from);
		while (start && start !== this._$endNode) {
			const n = wrap(start).nextSibling;
			wrap(start).remove();
			start = n;
		}
	}
	/**
	 * Implementation of RootPart's `isConnected`. Note that this method
	 * should only be called on `RootPart`s (the `ChildPart` returned from a
	 * top-level `render()` call). It has no effect on non-root ChildParts.
	 * @param isConnected Whether to set
	 * @internal
	 */
	setConnected(isConnected) {
		if (this._$parent === undefined) {
			this.__isConnected = isConnected;
			this._$notifyConnectionChanged?.(isConnected);
		} else if (DEV_MODE) {
			throw new Error(
				"part.setConnected() may only be called on a " +
					"RootPart returned from render().",
			);
		}
	}
}

/**
 * A top-level `ChildPart` returned from `render` that manages the connected
 * state of `AsyncDirective`s created throughout the tree below it.
 */

class AttributePart {
	type = ATTRIBUTE_PART;

	/**
	 * If this attribute part represents an interpolation, this contains the
	 * static strings of the interpolation. For single-value, complete bindings,
	 * this is undefined.
	 */

	/** @internal */
	_$committedValue = nothing;
	/** @internal */

	/** @internal */

	/** @internal */
	_$disconnectableChildren = undefined;
	get tagName() {
		return this.element.tagName;
	}

	// See comment in Disconnectable interface for why this is a getter
	get _$isConnected() {
		return this._$parent._$isConnected;
	}
	constructor(element, name, strings, parent, options) {
		this.element = element;
		this.name = name;
		this._$parent = parent;
		this.options = options;
		if (strings.length > 2 || strings[0] !== "" || strings[1] !== "") {
			this._$committedValue = new Array(strings.length - 1).fill(new String());
			this.strings = strings;
		} else {
			this._$committedValue = nothing;
		}
		if (ENABLE_EXTRA_SECURITY_HOOKS) {
			this._sanitizer = undefined;
		}
	}

	/**
	 * Sets the value of this part by resolving the value from possibly multiple
	 * values and static strings and committing it to the DOM.
	 * If this part is single-valued, `this._strings` will be undefined, and the
	 * method will be called with a single value argument. If this part is
	 * multi-value, `this._strings` will be defined, and the method is called
	 * with the value array of the part's owning TemplateInstance, and an offset
	 * into the value array from which the values should be read.
	 * This method is overloaded this way to eliminate short-lived array slices
	 * of the template instance values, and allow a fast-path for single-valued
	 * parts.
	 *
	 * @param value The part value, or an array of values for multi-valued parts
	 * @param valueIndex the index to start reading values from. `undefined` for
	 *   single-valued parts
	 * @param noCommit causes the part to not commit its value to the DOM. Used
	 *   in hydration to prime attribute parts with their first-rendered value,
	 *   but not set the attribute, and in SSR to no-op the DOM operation and
	 *   capture the value for serialization.
	 *
	 * @internal
	 */
	_$setValue(value, directiveParent = this, valueIndex, noCommit) {
		const strings = this.strings;

		// Whether any of the values has changed, for dirty-checking
		let change = false;
		if (strings === undefined) {
			// Single-value binding case
			value = resolveDirective(this, value, directiveParent, 0);
			change =
				!isPrimitive(value) ||
				(value !== this._$committedValue && value !== noChange);
			if (change) {
				this._$committedValue = value;
			}
		} else {
			// Interpolation case
			const values = value;
			value = strings[0];
			let i, v;
			for (i = 0; i < strings.length - 1; i++) {
				v = resolveDirective(this, values[valueIndex + i], directiveParent, i);
				if (v === noChange) {
					// If the user-provided value is `noChange`, use the previous value
					v = this._$committedValue[i];
				}
				change ||= !isPrimitive(v) || v !== this._$committedValue[i];
				if (v === nothing) {
					value = nothing;
				} else if (value !== nothing) {
					value += (v ?? "") + strings[i + 1];
				}
				// We always record each value, even if one is `nothing`, for future
				// change detection.
				this._$committedValue[i] = v;
			}
		}
		if (change && !noCommit) {
			this._commitValue(value);
		}
	}

	/** @internal */
	_commitValue(value) {
		if (value === nothing) {
			wrap(this.element).removeAttribute(this.name);
		} else {
			if (ENABLE_EXTRA_SECURITY_HOOKS) {
				if (this._sanitizer === undefined) {
					this._sanitizer = sanitizerFactoryInternal(
						this.element,
						this.name,
						"attribute",
					);
				}
				value = this._sanitizer(value ?? "");
			}
			debugLogEvent?.({
				kind: "commit attribute",
				element: this.element,
				name: this.name,
				value,
				options: this.options,
			});
			wrap(this.element).setAttribute(this.name, value ?? "");
		}
	}
}
class PropertyPart extends AttributePart {
	type = PROPERTY_PART;

	/** @internal */
	_commitValue(value) {
		if (ENABLE_EXTRA_SECURITY_HOOKS) {
			if (this._sanitizer === undefined) {
				this._sanitizer = sanitizerFactoryInternal(
					this.element,
					this.name,
					"property",
				);
			}
			value = this._sanitizer(value);
		}
		debugLogEvent &&
			debugLogEvent({
				kind: "commit property",
				element: this.element,
				name: this.name,
				value,
				options: this.options,
			});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.element[this.name] = value === nothing ? undefined : value;
	}
}
class BooleanAttributePart extends AttributePart {
	type = BOOLEAN_ATTRIBUTE_PART;

	/** @internal */
	_commitValue(value) {
		debugLogEvent?.({
			kind: "commit boolean attribute",
			element: this.element,
			name: this.name,
			value: !!(value && value !== nothing),
			options: this.options,
		});
		wrap(this.element).toggleAttribute(this.name, !!value && value !== nothing);
	}
}

/**
 * An AttributePart that manages an event listener via add/removeEventListener.
 *
 * This part works by adding itself as the event listener on an element, then
 * delegating to the value passed to it. This reduces the number of calls to
 * add/removeEventListener if the listener changes frequently, such as when an
 * inline function is used as a listener.
 *
 * Because event options are passed when adding listeners, we must take case
 * to add and remove the part as a listener when the event options change.
 */

class EventPart extends AttributePart {
	type = EVENT_PART;
	constructor(element, name, strings, parent, options) {
		super(element, name, strings, parent, options);
		if (DEV_MODE && this.strings !== undefined) {
			throw new Error(
				`A \`<${element.localName}>\` has a \`@${name}=...\` listener with ` +
					"invalid content. Event listeners in templates must have exactly " +
					"one expression and no surrounding text.",
			);
		}
	}

	// EventPart does not use the base _$setValue/_resolveValue implementation
	// since the dirty checking is more complex
	/** @internal */
	_$setValue(newListener, directiveParent = this) {
		newListener =
			resolveDirective(this, newListener, directiveParent, 0) ?? nothing;
		if (newListener === noChange) {
			return;
		}
		const oldListener = this._$committedValue;

		// If the new value is nothing or any options change we have to remove the
		// part as a listener.
		const shouldRemoveListener =
			(newListener === nothing && oldListener !== nothing) ||
			newListener.capture !== oldListener.capture ||
			newListener.once !== oldListener.once ||
			newListener.passive !== oldListener.passive;

		// If the new value is not nothing and we removed the listener, we have
		// to add the part as a listener.
		const shouldAddListener =
			newListener !== nothing &&
			(oldListener === nothing || shouldRemoveListener);
		debugLogEvent?.({
			kind: "commit event listener",
			element: this.element,
			name: this.name,
			value: newListener,
			options: this.options,
			removeListener: shouldRemoveListener,
			addListener: shouldAddListener,
			oldListener,
		});
		if (shouldRemoveListener) {
			this.element.removeEventListener(this.name, this, oldListener);
		}
		if (shouldAddListener) {
			// Beware: IE11 and Chrome 41 don't like using the listener as the
			// options object. Figure out how to deal w/ this in IE11 - maybe
			// patch addEventListener?
			this.element.addEventListener(this.name, this, newListener);
		}
		this._$committedValue = newListener;
	}
	handleEvent(event) {
		if (typeof this._$committedValue === "function") {
			this._$committedValue.call(this.options?.host ?? this.element, event);
		} else {
			this._$committedValue.handleEvent(event);
		}
	}
}
class ElementPart {
	type = ELEMENT_PART;

	/** @internal */

	// This is to ensure that every Part has a _$committedValue

	/** @internal */

	/** @internal */
	_$disconnectableChildren = undefined;
	constructor(element, parent, options) {
		this.element = element;
		this._$parent = parent;
		this.options = options;
	}

	// See comment in Disconnectable interface for why this is a getter
	get _$isConnected() {
		return this._$parent._$isConnected;
	}
	_$setValue(value) {
		debugLogEvent?.({
			kind: "commit to element binding",
			element: this.element,
			value,
			options: this.options,
		});
		resolveDirective(this, value);
	}
}

/**
 * END USERS SHOULD NOT RELY ON THIS OBJECT.
 *
 * Private exports for use by other Lit packages, not intended for use by
 * external users.
 *
 * We currently do not make a mangled rollup build of the lit-ssr code. In order
 * to keep a number of (otherwise private) top-level exports mangled in the
 * client side code, we a _$LH object containing those members (or
 * helper methods for accessing private fields of those members), and then
 * re-them for use in lit-ssr. This keeps lit-ssr agnostic to whether the
 * client-side code is being used in `dev` mode or `prod` mode.
 *
 * This has a unique name, to disambiguate it from private exports in
 * lit-element, which re-exports all of lit-html.
 *
 * @private
 */
const _$LH = {
	// Used in lit-ssr
	_boundAttributeSuffix: boundAttributeSuffix,
	_marker: marker,
	_markerMatch: markerMatch,
	_HTML_RESULT: HTML_RESULT,
	_getTemplateHtml: getTemplateHtml,
	// Used in tests and private-ssr-support
	_TemplateInstance: TemplateInstance,
	_isIterable: isIterable,
	_resolveDirective: resolveDirective,
	_ChildPart: ChildPart,
	_AttributePart: AttributePart,
	_BooleanAttributePart: BooleanAttributePart,
	_EventPart: EventPart,
	_PropertyPart: PropertyPart,
	_ElementPart: ElementPart,
};

// Apply polyfills if available
const polyfillSupport = DEV_MODE
	? global.litHtmlPolyfillSupportDevMode
	: global.litHtmlPolyfillSupport;
polyfillSupport?.(Template, ChildPart);

// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for lit-html usage.
(global.litHtmlVersions ??= []).push("3.2.0");
if (DEV_MODE && global.litHtmlVersions.length > 1) {
	issueWarning(
		"multiple-versions",
		`Multiple versions of Lit loaded. ` +
			`Loading multiple versions is not recommended.`,
	);
}

/**
 * Renders a value, usually a lit-html TemplateResult, to the container.
 *
 * This example renders the text "Hello, Zoe!" inside a paragraph tag, appending
 * it to the container `document.body`.
 *
 * ```js
 * import {html, render} from 'lit';
 *
 * const name = "Zoe";
 * render(html`<p>Hello, ${name}!</p>`, document.body);
 * ```
 *
 * @param value Any [renderable
 *   value](https://lit.dev/docs/templates/expressions/#child-expressions),
 *   typically a {@linkcode TemplateResult} created by evaluating a template tag
 *   like {@linkcode html} or {@linkcode svg}.
 * @param container A DOM container to render to. The first render will append
 *   the rendered value to the container, and subsequent renders will
 *   efficiently update the rendered value if the same result type was
 *   previously rendered there.
 * @param options See {@linkcode RenderOptions} for options documentation.
 * @see
 * {@link https://lit.dev/docs/libraries/standalone-templates/#rendering-lit-html-templates| Rendering Lit HTML Templates}
 */
const render = (value, container, options) => {
	if (DEV_MODE && container == null) {
		// Give a clearer error message than
		//     Uncaught TypeError: Cannot read properties of null (reading
		//     '_$litPart$')
		// which reads like an internal Lit error.
		throw new TypeError(`The container to render into may not be ${container}`);
	}
	const renderId = DEV_MODE ? debugLogRenderId++ : 0;
	const partOwnerNode = options?.renderBefore ?? container;
	// This property needs to remain unminified.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let part = partOwnerNode["_$litPart$"];
	debugLogEvent?.({
		kind: "begin render",
		id: renderId,
		value,
		container,
		options,
		part,
	});
	if (part === undefined) {
		const endNode = options?.renderBefore ?? null;
		// This property needs to remain unminified.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		partOwnerNode["_$litPart$"] = part = new ChildPart(
			container.insertBefore(createMarker(), endNode),
			endNode,
			undefined,
			options ?? {},
		);
	}
	part._$setValue(value);
	debugLogEvent?.({
		kind: "end render",
		id: renderId,
		value,
		container,
		options,
		part,
	});
	return part;
};
if (ENABLE_EXTRA_SECURITY_HOOKS) {
	render.setSanitizer = setSanitizer;
	render.createSanitizer = createSanitizer;
	if (DEV_MODE) {
		render._testOnlyClearSanitizerFactoryDoNotCallOrElse =
			_testOnlyClearSanitizerFactoryDoNotCallOrElse;
	}
}

/**
 * Prevents JSON injection attacks.
 *
 * The goals of this brand:
 *   1) fast to check
 *   2) code is small on the wire
 *   3) multiple versions of Lit in a single page will all produce mutually
 *      interoperable StaticValues
 *   4) normal JSON.parse (without an unusual reviver) can not produce a
 *      StaticValue
 *
 * Symbols satisfy (1), (2), and (4). We use Symbol.for to satisfy (3), but
 * we don't care about the key, so we break ties via (2) and use the empty
 * string.
 */
const brand = Symbol.for("");

/** Safely extracts the string part of a StaticValue. */
const unwrapStaticValue = (value) => {
	if (value?.r !== brand) {
		return undefined;
	}
	return value?.["_$litStatic$"];
};

/**
 * Wraps a string so that it behaves like part of the static template
 * strings instead of a dynamic value.
 *
 * Users must take care to ensure that adding the static string to the template
 * results in well-formed HTML, or else templates may break unexpectedly.
 *
 * Note that this function is unsafe to use on untrusted content, as it will be
 * directly parsed into HTML. Do not pass user input to this function
 * without sanitizing it.
 *
 * Static values can be changed, but they will cause a complete re-render
 * since they effectively create a new template.
 */
const unsafeStatic = (value) => ({
	["_$litStatic$"]: value,
	r: brand,
});
const textFromStatic = (value) => {
	if (value["_$litStatic$"] !== undefined) {
		return value["_$litStatic$"];
	}
	throw new Error(`Value passed to 'literal' function must be a 'literal' result: ${value}. Use 'unsafeStatic' to pass non-literal values, but
            take care to ensure page security.`);
};

/**
 * Tags a string literal so that it behaves like part of the static template
 * strings instead of a dynamic value.
 *
 * The only values that may be used in template expressions are other tagged
 * `literal` results or `unsafeStatic` values (note that untrusted content
 * should never be passed to `unsafeStatic`).
 *
 * Users must take care to ensure that adding the static string to the template
 * results in well-formed HTML, or else templates may break unexpectedly.
 *
 * Static values can be changed, but they will cause a complete re-render since
 * they effectively create a new template.
 */
const literal = (strings, ...values) => ({
	["_$litStatic$"]: values.reduce(
		(acc, v, idx) => acc + textFromStatic(v) + strings[idx + 1],
		strings[0],
	),
	r: brand,
});
const stringsCache = new Map();

/**
 * Wraps a lit-html template tag (`html` or `svg`) to add static value support.
 */
const withStatic =
	(coreTag) =>
	(strings, ...values) => {
		const l = values.length;
		let staticValue;
		let dynamicValue;
		const staticStrings = [];
		const dynamicValues = [];
		let i = 0;
		let hasStatics = false;
		let s;
		while (i < l) {
			s = strings[i];
			// Collect any unsafeStatic values, and their following template strings
			// so that we treat a run of template strings and unsafe static values as
			// a single template string.
			while (
				i < l &&
				((dynamicValue = values[i]),
				(staticValue = unwrapStaticValue(dynamicValue))) !== undefined
			) {
				s += staticValue + strings[++i];
				hasStatics = true;
			}
			// If the last value is static, we don't need to push it.
			if (i !== l) {
				dynamicValues.push(dynamicValue);
			}
			staticStrings.push(s);
			i++;
		}
		// If the last value isn't static (which would have consumed the last
		// string), then we need to add the last string.
		if (i === l) {
			staticStrings.push(strings[l]);
		}
		if (hasStatics) {
			const key = staticStrings.join("$$lit$$");
			strings = stringsCache.get(key);
			if (strings === undefined) {
				// Beware: in general this pattern is unsafe, and doing so may bypass
				// lit's security checks and allow an attacker to execute arbitrary
				// code and inject arbitrary content.
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				staticStrings.raw = staticStrings;
				stringsCache.set(key, (strings = staticStrings));
			}
			values = dynamicValues;
		}
		return coreTag(strings, ...values);
	};

/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 *
 * Includes static value support from `lit-html/static.js`.
 */
const staticHTML = withStatic(html);
const unsafeHTML = (html) => staticHTML`${unsafeStatic(html)}`;
const staticSVG = withStatic(svg);
const unsafeSVG = (svg) => staticSVG`${unsafeStatic(svg)}`;
/**
 * Interprets a template literal as an SVG template that can efficiently
 * render to and update a container.
 *
 * Includes static value support from `lit-html/static.js`.
 */

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * This utility type extracts the signature of a directive class's render()
 * method so we can use it for the type of the generated directive function.
 */

/**
 * A generated directive function doesn't evaluate the directive, but just
 * returns a DirectiveResult object that captures the arguments.
 */

const PartType = {
	ATTRIBUTE: 1,
	CHILD: 2,
	PROPERTY: 3,
	BOOLEAN_ATTRIBUTE: 4,
	EVENT: 5,
	ELEMENT: 6,
};

/**
 * Information about the part a directive is bound to.
 *
 * This is useful for checking that a directive is attached to a valid part,
 * such as with directive that can only be used on attribute bindings.
 */

/**
 * Creates a user-facing directive function from a Directive class. This
 * function has the same parameters as the directive's render() method.
 */
const directive =
	(c) =>
	(...values) => ({
		// This property needs to remain unminified.
		["_$litDirective$"]: c,
		values,
	});

/**
 * Base class for creating custom directives. Users should extend this class,
 * implement `render` and/or `update`, and then pass their subclass to
 * `directive`.
 */
class Directive {
	constructor(_partInfo) {}

	// See comment in Disconnectable interface for why this is a getter
	get _$isConnected() {
		return this._$parent._$isConnected;
	}

	/** @internal */
	_$initialize(part, parent, attributeIndex) {
		this.__part = part;
		this._$parent = parent;
		this.__attributeIndex = attributeIndex;
	}
	/** @internal */
	_$resolve(part, props) {
		return this.update(part, props);
	}
	update(_part, props) {
		return this.render(...props);
	}
}

/**
 * Tests if a value is a primitive value.
 *
 * See https://tc39.github.io/ecma262/#sec-typeof-operator
 */
const TemplateResultType = {
	HTML: 1,
	SVG: 2,
	MATHML: 3,
};
/**
 * Tests if a value is a TemplateResult or a CompiledTemplateResult.
 */
const isTemplateResult = (value, type) =>
	type === undefined
		? // This property needs to remain unminified.
			value?.["_$litType$"] !== undefined
		: value?.["_$litType$"] === type;

/**
 * Tests if a value is a CompiledTemplateResult.
 */
const isCompiledTemplateResult = (value) => {
	return value?.["_$litType$"]?.h != null;
};

/**
 * Tests if a value is a DirectiveResult.
 */
const isDirectiveResult = (value) =>
	// This property needs to remain unminified.
	value?.["_$litDirective$"] !== undefined;

/**
 * Retrieves the Directive class for a DirectiveResult
 */
const getDirectiveClass = (value) =>
	// This property needs to remain unminified.
	value?.["_$litDirective$"];

/**
 * Tests whether a part has only a single-expression with no strings to
 * interpolate between.
 *
 * Only AttributePart and PropertyPart can have multiple expressions.
 * Multi-expression parts have a `strings` property and single-expression
 * parts do not.
 */
const isSingleExpression = (part) => part.strings === undefined;

/**
 * Inserts a ChildPart into the given container ChildPart's DOM, either at the
 * end of the container ChildPart, or before the optional `refPart`.
 *
 * This does not add the part to the containerPart's committed value. That must
 * be done by callers.
 *
 * @param containerPart Part within which to add the new ChildPart
 * @param refPart Part before which to add the new ChildPart; when omitted the
 *     part added to the end of the `containerPart`
 * @param part Part to insert, or undefined to create a new part
 */
const insertPart = (containerPart, refPart, part) => {
	const container = wrap(containerPart._$startNode).parentNode;
	const refNode =
		refPart === undefined ? containerPart._$endNode : refPart._$startNode;
	if (part === undefined) {
		const startNode = wrap(container).insertBefore(createMarker(), refNode);
		const endNode = wrap(container).insertBefore(createMarker(), refNode);
		part = new ChildPart(
			startNode,
			endNode,
			containerPart,
			containerPart.options,
		);
	} else {
		const endNode = wrap(part._$endNode).nextSibling;
		const oldParent = part._$parent;
		const parentChanged = oldParent !== containerPart;
		if (parentChanged) {
			part._$reparentDisconnectables?.(containerPart);
			// Note that although `_$reparentDisconnectables` updates the part's
			// `_$parent` reference after unlinking from its current parent, that
			// method only exists if Disconnectables are present, so we need to
			// unconditionally set it here
			part._$parent = containerPart;
			// Since the _$isConnected getter is somewhat costly, only
			// read it once we know the subtree has directives that need
			// to be notified
			let newConnectionState;
			if (
				part._$notifyConnectionChanged !== undefined &&
				(newConnectionState = containerPart._$isConnected) !==
					oldParent._$isConnected
			) {
				part._$notifyConnectionChanged(newConnectionState);
			}
		}
		if (endNode !== refNode || parentChanged) {
			let start = part._$startNode;
			while (start !== endNode) {
				const n = wrap(start).nextSibling;
				wrap(container).insertBefore(start, refNode);
				start = n;
			}
		}
	}
	return part;
};

/**
 * Sets the value of a Part.
 *
 * Note that this should only be used to set/update the value of user-created
 * parts (i.e. those created using `insertPart`); it should not be used
 * by directives to set the value of the directive's container part. Directives
 * should return a value from `update`/`render` to update their part state.
 *
 * For directives that require setting their part value asynchronously, they
 * should extend `AsyncDirective` and call `this.setValue()`.
 *
 * @param part Part to set
 * @param value Value to set
 * @param index For `AttributePart`s, the index to set
 * @param directiveParent Used internally; should not be set by user
 */
const setChildPartValue = (part, value, directiveParent = part) => {
	part._$setValue(value, directiveParent);
	return part;
};

// A sentinel value that can never appear as a part value except when set by
// live(). Used to force a dirty-check to fail and cause a re-render.
const RESET_VALUE = {};

/**
 * Sets the committed value of a ChildPart directly without triggering the
 * commit stage of the part.
 *
 * This is useful in cases where a directive needs to update the part such
 * that the next update detects a value change or not. When value is omitted,
 * the next update will be guaranteed to be detected as a change.
 *
 * @param part
 * @param value
 */
const setCommittedValue = (part, value = RESET_VALUE) =>
	(part._$committedValue = value);

/**
 * Returns the committed value of a ChildPart.
 *
 * The committed value is used for change detection and efficient updates of
 * the part. It can differ from the value set by the template or directive in
 * cases where the template value is transformed before being committed.
 *
 * - `TemplateResult`s are committed as a `TemplateInstance`
 * - Iterables are committed as `Array<ChildPart>`
 * - All other types are committed as the template value or value returned or
 *   set by a directive.
 *
 * @param part
 */
const getCommittedValue = (part) => part._$committedValue;

/**
 * Removes a ChildPart from the DOM, including any of its content.
 *
 * @param part The Part to remove
 */
const removePart = (part) => {
	part._$notifyConnectionChanged?.(false, true);
	let start = part._$startNode;
	const end = wrap(part._$endNode).nextSibling;
	while (start !== end) {
		const n = wrap(start).nextSibling;
		wrap(start).remove();
		start = n;
	}
};
const clearPart = (part) => {
	part._$clear();
};

class Keyed extends Directive {
	key = nothing;
	render(k, v) {
		this.key = k;
		return v;
	}
	update(part, [k, v]) {
		if (k !== this.key) {
			// Clear the part before returning a value. The one-arg form of
			// setCommittedValue sets the value to a sentinel which forces a
			// commit the next render.
			setCommittedValue(part);
			this.key = k;
		}
		return v;
	}
}

/**
 * Associates a renderable value with a unique key. When the key changes, the
 * previous DOM is removed and disposed before rendering the next value, even
 * if the value - such as a template - is the same.
 *
 * This is useful for forcing re-renders of stateful components, or working
 * with code that expects new data to generate new HTML elements, such as some
 * animation techniques.
 */
const keyed = directive(Keyed);

/**
 * The type of the class that powers this directive. Necessary for naming the
 * directive's return type.
 */

const helpers = {
	unsafeHTML,
	unsafeStatic,
	staticHTML,
	staticSVG,
	unsafeSVG,
	keyed,
	render,
	html,
	svg,
};
html.svg = svg;
APP.add(helpers, { prop: "helpers" });
APP.add(html, { library: "html" });

})();
await (async () => {
const shades = {
	0: 100,
	1: 98,
	5: 90,
	10: 80,
	20: 60,
	30: 40,
	40: 20,
	50: 0,
	60: -20,
	70: -30,
	80: -40,
	90: -55,
	95: -65,
	99: -80,
	100: -100,
};

const camelToKebab = (str) =>
	str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

// Single source of truth for generating color variables
const generateColorVariables = (colors) => {
	let cssString = "";
	let darkModeStyles = "";

	Object.entries(colors).forEach(([color, value]) => {
		const baseColorVar = `var(--color-${color})`;
		cssString += `  --color-${color}: ${value};\n`;

		Object.entries(shades).forEach(([shade, percentage]) => {
			const lightShade =
				percentage >= 0
					? `color-mix(in hsl, white ${percentage}%, ${baseColorVar})`
					: `color-mix(in hsl, ${baseColorVar}, black ${Math.abs(percentage)}%)`;

			const darkShade =
				percentage >= 0
					? `color-mix(in hsl, ${baseColorVar}, black ${percentage}%)`
					: `color-mix(in hsl, white ${Math.abs(percentage)}%, ${baseColorVar})`;

			cssString += `  --color-${color}-${shade}: ${lightShade};\n`;
			darkModeStyles += `  --color-${color}-${shade}: ${darkShade} !important;\n`;
		});
	});

	return { cssString, darkModeStyles };
};

// DOM application wrapper
const setColorVariables = (root, colors) => {
	const { cssString, darkModeStyles } = generateColorVariables(colors);

	// Apply light mode variables to root
	const lightModeVars = cssString.split("\n").filter(Boolean);
	lightModeVars.forEach((variable) => {
		const [name, value] = variable.trim().split(": ");
		root.style.setProperty(name, value.slice(0, -1)); // remove semicolon
	});

	// Apply dark mode styles
	const styleElement = document.createElement("style");
	styleElement.textContent = `.dark {\n${darkModeStyles}}`;
	document.head.appendChild(styleElement);
};

const generateGeneralVariables = (obj, prefix = "--") => {
	let cssString = "";
	Object.entries(obj).forEach(([key, value]) => {
		if (key === "colors") return;

		const cssVarName = `${prefix}${camelToKebab(key)}`;
		if (typeof value === "object" && value !== null) {
			cssString += generateGeneralVariables(value, `${cssVarName}-`);
		} else if (typeof value === "string" || typeof value === "number") {
			cssString += `  ${cssVarName}: ${value};\n`;
		}
	});

	return cssString;
};

const setGeneralVariables = (root, obj, prefix = "--") => {
	Object.entries(obj).forEach(([key, value]) => {
		const cssVarName = `${prefix}${camelToKebab(key)}`;
		if (typeof value === "object" && value !== null) {
			setGeneralVariables(root, value, `${cssVarName}-`);
		} else if (typeof value === "string" || typeof value === "number") {
			root.style.setProperty(cssVarName, `${value}`);
		}
	});
};

const setCSSVariables = ({ colors, ...theme }) => {
	const root = document.documentElement;
	setColorVariables(root, colors);
	setGeneralVariables(root, theme, "--");
};

// Build-time CSS generation
const generateThemeCSS = () => {
	const { colors, ...theme } = self.APP.theme;
	const { cssString: colorVars, darkModeStyles } =
		generateColorVariables(colors);
	const generalVars = generateGeneralVariables(theme);
	console.log({ theme, generalVars });
	return `:root {
${colorVars}${generalVars}}

.dark {
${darkModeStyles}}`;
};

// Helper function to generate CSS rules from resolved properties
const generateCSSRules = (tag, resolvedProps) => {
	return Object.entries(resolvedProps)
		.map(([property, value]) => {
			if (value === false || value === null || value === undefined) {
				return `--${tag}-${property}: null;`;
			}
			if (value && value !== true) {
				return `--${tag}-${property}: ${value};`;
			}
			return "";
		})
		.filter(Boolean) // Remove empty strings
		.join(" ");
};

// Main function to generate variant styles
const generateVariantStyles = (component) => {
	const { tag, theme: config, properties } = component;
	const variantsConfig = config.types;
	if (!variantsConfig) return ""; // Exit early if no types are defined

	let variantCSS = "";

	// Iterate over each variant
	for (const [variantName, variantProps] of Object.entries(variantsConfig)) {
		// Handle static variantProps directly
		if (typeof variantProps !== "function") {
			const rules = generateCSSRules(tag, variantProps);
			if (rules) variantCSS += `&[${variantName}] { ${rules} }\n`;
			continue;
		}

		// Proxy to detect which property is being accessed dynamically
		let accessedField = null;
		const getterProxy = new Proxy(
			{},
			{
				get(_, field) {
					accessedField = field; // Detect accessed field name
					return field;
				},
			},
		);

		// Execute the function to determine the target field
		variantProps(getterProxy);
		const enums = properties?.[accessedField]?.enum || [];
		if (!accessedField || enums.length === 0) continue;

		// Generate rules for each enum value once
		for (const enumValue of enums) {
			// Resolve properties for this enum value
			const resolvedProps = variantProps({ [accessedField]: enumValue });
			const rules = generateCSSRules(tag, resolvedProps);

			// Append the rules for the specific enum value
			if (rules) {
				variantCSS += `&${variantName === "default" ? "" : `[${variantName}]`}[${accessedField}="${enumValue}"] { ${rules} }\n`;
			}
		}
	}
	return variantCSS;
};

const generateCSSBlock = ({
	attr,
	key,
	fn,
	tag,
	values,
	inject,
	injectionKey,
}) => {
	const stylesObject = fn(key);
	let rules = "";
	for (const [property, cssValue] of Object.entries(stylesObject)) {
		const finalValue = values[key]
			? String(cssValue).replace(key, values[key])
			: cssValue;
		const cssRule = `${property}: ${finalValue};`;
		rules += `${cssRule} `;
	}
	const finalRule = `&[${attr}~="${key}"] { ${rules} }\n`;

	if (inject && injectionKey) {
		if (!inject.has(injectionKey)) {
			const classRule = `.${tag} { ${finalRule} }\n`;
			globalStyleTag.textContent += classRule;
			inject.add(injectionKey);
		}
	}
};

const globalStyleTag = (() => {
	let styleTag = document.querySelector("#compstyles");
	if (!styleTag) {
		styleTag = document.createElement("style");
		styleTag.id = "compstyles";
		document.head.appendChild(styleTag);
	}
	return styleTag;
})();

const Theme = new Map();

const init = () => {
	const { theme } = self.APP;
	setCSSVariables(theme);
};

const library = {
	generateCSSBlock,
	generateThemeCSS,
	async loadStyle(component) {
		const tagName = component.tag;
		if (Theme.has(tagName)) return;
		Theme.set(tagName, "");
		const css = [];
		if (component.theme?.types) css.push(generateVariantStyles(component));

		if (self.APP.config.ENV !== "PRODUCTION") {
			const style = await self.APP.helpers.fetchCSS(
				`${component.path}/style.css`,
			);
			if (style) css.push(style);
		}

		if (css.length > 0) {
			globalStyleTag.textContent += `.${tagName} { ${css.join("\n")} }`;
		}
	},
};

// Helper functions
const getSize = (entry, multiplier) => {
	const size = window.APP.theme.sizes[entry] || entry;
	if (typeof size === "number")
		return multiplier ? `calc(${size}px * ${multiplier})` : `${size}px`;
	return size;
};

function getTextSize(size, opts = {}) {
	const baseValue = opts.base ?? window.APP.theme.text.base;
	const ratio = opts.ratio ?? window.APP.theme.text.ratio;
	const baseIndex = window.APP.theme.text.sizes.indexOf("md");
	const sizeIndex = window.APP.theme.text.sizes.indexOf(size);

	const diff = sizeIndex - baseIndex;
	const result =
		diff < 0 ? baseValue / ratio ** Math.abs(diff) : baseValue * ratio ** diff;
	return `${result.toFixed(2)}rem`;
}

function getSizes(sizes) {
	const result = [...sizes];
	sizes.forEach((size1) => {
		sizes.forEach((size2) => {
			if (size1 !== size2) {
				result.push(`${size1}-${size2}`);
			}
		});
	});
	return result;
}

const loadFont = (extension, fontConfig) => {
	const { fontName, weights } = fontConfig;
	const fontFaces = weights
		.map((weight) => {
			const fontWeight =
				{
					extralight: 200,
					light: 300,
					regular: 400,
					medium: 500,
					semibold: 600,
					bold: 700,
					extrabold: 800,
				}[weight] || 400;
			return `
        @font-face {
          font-family: '${fontName}';
          font-weight: ${fontWeight};
          src: url('${self.APP.config.BASE_PATH}/extensions/${extension}/${weight}.woff2') format('woff2');
        }
      `;
		})
		.join("\n");
	const style = document.createElement("style");
	style.textContent = fontFaces;
	document.head.appendChild(style);
};

// Register everything
self.APP.add(library, { library: "Theme" });
self.APP.add(
	{
		colors: {
			default: "darkgray",
			primary: "#00a7f1",
			secondary: "#007400",
			tertiary: "#00998d",
			success: "#49f09c",
			warning: "#fc8700",
			error: "#ff0040",
			surface: "darkgray",
		},
		font: {
			family:
				"'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
			iconFamily: "lucide",
			icon: { family: "lucide" },
		},
		background: {
			color: "var(--color-primary-10)",
		},
		button: {
			shade: 60,
			border: { shade: 90 },
		},
		text: {
			color: "var(--color-surface-100)",
			sizes: [
				"2xs",
				"xs",
				"sm",
				"md",
				"lg",
				"xl",
				"2xl",
				"xl",
				"2xl",
				"3xl",
				"4xl",
			],
			base: 1,
			ratio: 1.2,
		},
		border: {
			radius: "md",
			size: 1,
			color: "default",
		},
		radius: {
			xs: "2px",
			sm: "4px",
			md: "8px",
			lg: "12px",
			xl: "16px",
			"2xl": "24px",
			full: "100%",
		},
		spacing: {
			none: "0",
			xs: "0.25rem",
			sm: "0.5rem",
			md: "1rem",
			lg: "1.5rem",
			xl: "2rem",
			"2xl": "2.5rem",
			"3xl": "3rem",
			"4xl": "4rem",
		},
		sizes: {
			"3xs": 50,
			"2xs": 80,
			xs: 120,
			sm: 200,
			md: 320,
			lg: 480,
			xl: 768,
			"2xl": 1024,
			"3xl": 1280,
			"4xl": 1536,
			min: "min-content",
			max: "max-content",
			fit: "fit-content",
			"fit-content": "fit-content",
			screen: "100vh",
			full: "100%",
			auto: "auto",
		},
	},
	{ prop: "theme" },
);

// Load theme.css in development
const fetchCSS = async (path, addToStyle = false) => {
	const cssContent = await self.APP.helpers.fetchResource(
		path,
		async (response) => await response.text(),
		"css",
	);

	if (addToStyle && cssContent) {
		const styleElement = document.createElement("style");
		styleElement.textContent = cssContent;
		document.head.appendChild(styleElement);
	}

	return cssContent;
};

if (self.APP.config.ENV !== "PRODUCTION") fetchCSS("/theme.css", true);

APP.add(
	{ loadFont, getSize, getTextSize, getSizes, fetchCSS },
	{ prop: "helpers" },
);
self.APP.add([init], { prop: "init" });

})();
await (async () => {
const { Theme } = self.APP;
class ReactiveElement extends HTMLElement {
	static generateCSSBlock = Theme.generateCSSBlock;
	static get observedAttributes() {
		return Object.keys(this.properties).filter(
			(key) => this.properties[key].attribute !== false,
		);
	}

	static properties = {};
	constructor() {
		super();
		this.state = {};
		this._hasUpdated = false;
		this._isUpdating = false;
		this._changedProps = {};
		this._observers = new Map();
		this._scheduledUpdate = null;
	}

	connectedCallback() {
		this._ignoreAttributeChange = false;
		if (this.constructor.properties)
			this.initProps(this.constructor.properties);
		this.requestUpdate();
	}

	propGetterSetter({ type, key, attribute = true }) {
		return {
			get: () => this.state[key],
			set: (newValue) => {
				const oldValue = this.state[key];
				if (oldValue !== newValue) {
					this.state[key] = newValue;
					if (attribute) {
						this.updateAttribute({
							key,
							value: newValue,
							type,
							skipPropUpdate: true,
						});
					}
					this.requestUpdate(key, oldValue);
				}
			},
		};
	}

	initProps(properties) {
		for (const [key, options] of Object.entries(properties)) {
			const { type, sync, defaultValue, attribute, setter } = options;
			let value = this[key];
			if (value !== undefined && !sync) {
				this.state[key] = value;
				this._changedProps[key] = value;
			}

			if (setter) {
				this[`set${key.charAt(0).toUpperCase() + key.slice(1)}`] = ((value) =>
					(this[key] = value)).bind(this);
			}
			if (!Object.getOwnPropertyDescriptor(this, key)) {
				Object.defineProperty(
					this,
					key,
					this.propGetterSetter({
						key,
						attribute,
						type,
					}),
				);
			}

			const hasAttribute = this.hasAttribute(key);
			if (!sync) {
				value ??= hasAttribute
					? this.convertAttributeValue?.(this.getAttribute?.(key), type)
					: defaultValue;

				if (value !== undefined) {
					this.state[key] = value;
				}
			}

			if (!hasAttribute && attribute && value !== undefined) {
				this.updateAttribute({
					key,
					value,
					skipPropUpdate: true,
					type,
				});
				this._changedProps[key] = defaultValue;
			}
		}
	}

	requestUpdate(key, oldValue) {
		if (key) this._changedProps[key] = oldValue;
		if (this._scheduledUpdate) {
			clearTimeout(this._scheduledUpdate);
			this._scheduledUpdate;
		}
		this._scheduledUpdate = setTimeout(() => {
			this.scheduleUpdate({ ...this._changedProps }, key === undefined);
		}, 0);
	}

	scheduleUpdate(changedProps, forceUpdate) {
		if (forceUpdate || this.shouldUpdate(changedProps)) {
			this.willUpdate(changedProps);
			this.update(changedProps);
			if (!this._hasUpdated) {
				this._hasUpdated = true;
				this.firstUpdated(changedProps);
			}
			this.updated(changedProps);

			Object.keys(changedProps).forEach((key) => {
				delete this._changedProps[key];
			});
		}
		this._scheduledUpdate = null;
	}

	shouldUpdate(changedProps) {
		for (const [key, oldValue] of Object.entries(changedProps)) {
			const newValue = this[key];
			const prop = this.constructor.properties[key];
			const hasChanged = prop?.hasChanged
				? prop.hasChanged(newValue, oldValue)
				: oldValue !== newValue &&
					// biome-ignore lint/suspicious/noSelfCompare: This ensures (oldValue==NaN, newValue==NaN) always returns false
					(oldValue === oldValue || newValue === newValue);
			if (!hasChanged) {
				delete changedProps[key];
			}
		}
		return Object.keys(changedProps).length > 0 || !this._hasUpdated;
	}

	willUpdate(changedProps) {}

	updated(changedProps) {}

	firstUpdated(changedProps) {}

	update() {
		window.APP.helpers.render(this.render(), this);
	}

	render() {
		return window.APP.html``;
	}

	devCreateStyle(component, key, value) {
		if (component.theme?.[key]) {
			const enums = component.properties[key]?.enum;
			if (typeof component.theme[key] === "function") {
				const theme = component.theme[key];
				const tag = component.tag;
				const injectionKey = `${tag}-${key}-${value}`;
				if (!injectedCSSRules.has(injectionKey))
					this.constructor.generateCSSBlock({
						attr: key,
						tag,
						values: enums || [],
						fn: theme,
						key: value,
						inject: injectedCSSRules,
						injectionKey,
					});
			}
		}
		if (component.__proto__.theme) {
			this.devCreateStyle(component.__proto__, key, value);
		}
	}

	attributeChangedCallback(key, oldValue, newValue) {
		this.devCreateStyle(this.constructor, key, newValue);
		if (this._ignoreAttributeChange) return;
		if (oldValue !== newValue) {
			const type = this.constructor.properties[key]?.type;
			const value = this.convertAttributeValue(newValue, type);
			this.state[key] = value;
			this.requestUpdate(key, oldValue);
		}
	}

	convertAttributeValue(value, type) {
		switch (type) {
			case "boolean":
				return value !== null && value !== "false";
			case "number":
				return Number(value);
			case "string":
				return value;
			case "array":
			case "object":
				try {
					return JSON.parse(value);
				} catch (error) {
					console.error({ error });
					return value;
				}
			default:
				return value;
		}
	}

	updateAttribute({ key, value, type: _type, skipPropUpdate = false } = {}) {
		let prop = this.constructor.properties[key];
		if (!prop) {
			key = Object.keys(this.constructor.properties).find(
				(k) => this.constructor.properties[k].key === key,
			);
			prop = this.constructor.properties[key];
		}

		const type = _type || prop.type;
		if (!prop.attribute || !type) {
			return;
		}
		this._ignoreAttributeChange = skipPropUpdate;
		if (type === "boolean") {
			if (value) {
				this.setAttribute(key, "");
			} else {
				this.removeAttribute(key);
			}
		} else if (["array", "object"].includes(type)) {
			try {
				this.setAttribute(key, JSON.stringify(value));
			} catch {}
		} else {
			this.setAttribute(key, value);
		}
		if (skipPropUpdate) this._ignoreAttributeChange = false;
	}
}

const injectedCSSRules = new Set();
self.APP.add(ReactiveElement, { library: "ReactiveElement" });

})();
await (async () => {
const { Theme, config, helpers } = self.APP;
const Components = new Map();
const triedComponents = new Set();

const loadUndefinedComponents = async (element = document) => {
	const tagName = element?.tagName?.toLowerCase();
	if (tagName && triedComponents.has(tagName)) return;
	if (tagName) {
		triedComponents.add(tagName);
		await loadComponent(tagName);
	}
	const undefinedComponents = element.querySelectorAll(":not(:defined)");
	undefinedComponents.forEach((node) => {
		if (!triedComponents.has(node.tagName.toLowerCase())) {
			requestAnimationFrame(() => {
				if (!triedComponents.has(node.tagName.toLowerCase()))
					loadUndefinedComponents(node);
			});
		}
	});
};

const observeDOMChanges = () => {
	const observer = new MutationObserver(async (mutationsList) => {
		for (const mutation of mutationsList) {
			if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
				mutation.addedNodes.forEach(async (node) => {
					if (node.tagName) {
						const tagName = node.tagName;
						if (
							node.nodeType === Node.ELEMENT_NODE &&
							tagName.includes("-") &&
							!triedComponents.has(tagName)
						) {
							await loadUndefinedComponents();
							return;
						}
					}
				});
			}
		}
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});
};

const resolvePath = (tagName) => {
	const parts = tagName.split("-");
	const isExtension = window?.APP.extensions[parts[0]] !== undefined;
	if (isExtension) {
		return `${config.BASE_PATH}/extensions/${parts.join("/")}`;
	}
	return tagName.replace(/-/g, "/");
};

const addComponent = (Component, { tag, style }) => {
	Component.tag = tag;
	Component.path = resolvePath(tag);
	self.APP.add(Component, { style, tag });
	if (!customElements.get(tag)) customElements.define(tag, Component);
	if (style) Theme.loadStyle(Component);
	Components.set(tag, Component);
};

const loadComponent = async (_tagName) => {
	const tag = _tagName.toLowerCase();
	if (Components.has(tag)) {
		return Components.get(tag);
	}

	const path = resolvePath(tag);
	try {
		await helpers.importJS(`${path}/index.js`, { tag });
		return Components.get(tag);
	} catch (error) {
		console.warn(`Failed to load component from: ${path}`, error);
		throw error;
	}
};

const getComponent = async (tagName) => {
	if (Components.has(tagName)) {
		return Components.get(tagName);
	}
	try {
		return await loadComponent(tagName);
	} catch (error) {
		console.error(`Failed to get component: ${tagName}`, error);
		return null;
	}
};

const init = () => {
	loadUndefinedComponents();
	observeDOMChanges();
};

const Loader = {
	add: addComponent,
	get: getComponent,
	load: loadComponent,
};

if (self.APP.IS_DEV) {
	APP.add([init], { prop: "init" });
}
self.APP.add(Loader, { library: "Loader" });

})();
await (async () => {
window.$ = (element) => document.querySelector(element);
window.$$ = (element) => document.querySelectorAll(element);

function addClassTags(element, proto) {
	if (proto?.constructor) {
		addClassTags(element, Object.getPrototypeOf(proto));
		if (proto.constructor.tag) {
			element.classList.add(proto.constructor.tag);
		}
	}
}
const { ReactiveElement, Loader } = self.APP;

class View extends ReactiveElement {
	static add = Loader.add;
	static get = Loader.get;
	connectedCallback() {
		addClassTags(this, Object.getPrototypeOf(this));
		const component = this.constructor;
		const { Controller } = self.APP;
		const { _syncInstances } = Controller;
		if (this.dataset) {
			const { model, id, field, match, method } = this.dataset;
			if (model) {
				this.addDatasetProperties();
				if (Array.isArray(_syncInstances[model]))
					_syncInstances[model].push(this);
				else _syncInstances[model] = [this];
				component.properties = {
					...(component.properties || {}),
					"data-model": { type: "string" },
				};
			}
			this.___datafield =
				match ?? field ?? (id || method === "get" ? "item" : "collection");
		}
		if (component.properties) {
			Object.entries(component.properties)
				.filter(([, prop]) => prop.sync)
				.forEach(([key, prop]) =>
					component.defineSyncProperty(this, key, prop),
				);
		}
		super.connectedCallback();
		if (this.dataset.model) this.updateDataModel();
	}

	updateDataModel() {
		const { Controller, models } = self.APP;
		const { model, id, method } = this.dataset;
		const oplogMethods = {
			remove: () => {
				Controller.backend("REMOVE", {
					model,
					id,
				});
				this.requestDataSync(model, id);
			},
			edit: async (row) => {
				const response = await Controller.backend("EDIT", {
					model,
					row,
				});
				this.requestDataSync(model, row.id);
				return response;
			},
			add: async (row) => {
				const response = await Controller.backend("ADD", {
					model,
					row,
				});
				this.requestDataSync(model);
				return response;
			},
		};

		const methods = {
			...oplogMethods,
			props: models[model],
		};
		this.model = methods;
		if (method !== "add") {
			return this.requestDataSync(model, id);
		}
	}

	static defineSyncProperty = (instance, attributeKey, prop) => {
		const propKey = prop.key || attributeKey;
		const syncKey = getSyncKey(propKey, prop.sync);
		initializeSyncKey(syncKey, prop, attributeKey, instance);

		const store = self.APP.Controller[prop.sync];
		if (!store) return;

		const syncedProp = instance.constructor.properties[attributeKey];
		applySyncedPropertyBehavior(syncedProp, store, propKey, prop, syncKey);

		const storedValue = self.APP.helpers.stringToType(
			store.get(propKey)?.value,
			prop,
		);
		if (!isEmpty(storedValue)) {
			updateInstanceState(instance, attributeKey, storedValue, prop.type);
			return;
		}

		const attributeValue = getAttributeValue(instance, attributeKey, prop);
		handleInitialValue(
			instance,
			attributeKey,
			propKey,
			store,
			storedValue,
			attributeValue,
		);
	};

	requestDataSync(updatedModel, updatedId) {
		const { Controller } = self.APP;
		const { _syncInstances } = Controller;
		const { match, id, model, method = "", include, ...filter } = this.dataset;
		if (updatedId && id && updatedId !== id) return;
		if (updatedModel && updatedModel !== model) return;
		if (model) {
			if (!this.syncable) {
				if (!_syncInstances[model]) _syncInstances[model] = [];
				_syncInstances[model].push(this);
				this.syncable = true;
			}
			const opts = {};
			if (Object.keys(filter).length > 0) {
				opts.filter = JSON.stringify(filter);
			}
			if (include) {
				opts.include = include.split(",");
			}
			if (this.___datafield) {
				const dataObj = { id, model, opts };
				Controller.backend(
					id || method.toLowerCase() === "get" ? "GET" : "GET_MANY",
					dataObj,
				).then((results) => {
					this.requestUpdate(this.___datafield, this[this.___datafield]);
					this[this.___datafield] = match ? results[match] : results;
				});
			}
		}
	}
	static parentTag() {
		const parentProto = Object.getPrototypeOf(this);
		return parentProto.tag || null;
	}

	q(element) {
		return this.querySelector(element);
	}

	qa(element) {
		return this.querySelectorAll(element);
	}

	attr(value) {
		return JSON.stringify(value);
	}

	prop(prop) {
		return {
			value: this[prop],
			setValue: ((newValue) => (this[prop] = newValue)).bind(this),
		};
	}

	s(attr) {
		return JSON.stringify(this[attr]);
	}

	addDatasetProperties() {
		const datasetProperties = {};
		for (const [key, value] of Object.entries(this.dataset)) {
			datasetProperties[`data-${key}`] = { type: String };
		}
		this.constructor.properties = {
			...this.constructor.properties,
			...datasetProperties,
		};
	}

	on(eventType, handler, selector = null) {
		if (!this._eventListeners) this._eventListeners = [];
		if (selector) {
			const elements = this.qa(selector);
			elements.forEach((element) => {
				element.addEventListener(eventType, handler);
				this._eventListeners.push({ element, eventType, handler });
			});
		} else {
			this.addEventListener(eventType, handler);
			this._eventListeners.push({ element: this, eventType, handler });
		}
	}

	disconnectedCallback() {
		if (super.disconnectedCallback) {
			super.disconnectedCallback();
		}
		if (this._eventListeners) {
			this._eventListeners.forEach(({ element, eventType, handler }) => {
				element.removeEventListener(eventType, handler);
			});

			this._eventListeners = [];
		}
	}

	static register(tag, style) {
		this.add(this, { tag, style });
	}
}
const SYNC_KEY_SEPARATOR = "_-_";
const isEmpty = (value) => [undefined, null, ""].includes(value);

const syncKeyMap = new Map();
const syncKeyProps = new Map();
const syncKeyOldValues = new Map();
const syncKeyNewValues = new Map();
const syncKeyDerived = new Map();

function isEqual(a, b) {
	if (a === b) return true;
	return false;
}

const getSyncKey = (key, sync) => [key, SYNC_KEY_SEPARATOR, sync].join("");

function initializeSyncKey(syncKey, prop, attributeKey, instance) {
	const propWithAttributeKey = { ...prop, attributeKey };
	if (!syncKeyMap.has(syncKey)) {
		syncKeyMap.set(syncKey, new Set());
		syncKeyProps.set(syncKey, propWithAttributeKey);
	}
	syncKeyMap.get(syncKey).add(instance);

	if (prop.key?.includes(":")) {
		const [baseKey, filter] = prop.key.split(":");
		const parentSyncKey = `${baseKey}${SYNC_KEY_SEPARATOR}${prop.sync}`;

		if (!syncKeyMap.has(parentSyncKey)) {
			syncKeyMap.set(parentSyncKey, new Set());
		}

		const derived = syncKeyDerived.get(instance) || new Map();
		const filters = derived.get(baseKey) || {};
		derived.set(baseKey, { ...filters, [attributeKey]: filter });
		syncKeyDerived.set(instance, derived);
		syncKeyMap.get(parentSyncKey).add(instance);
	}
}

function applySyncedPropertyBehavior(syncedProp, store, key, prop, syncKey) {
	syncedProp.hasChanged = (newValue) => {
		if (!syncedProp._skipHasChanged) {
			const value = self.APP.helpers.stringToType(store.get(key)?.value, prop);
			if (newValue !== value) {
				syncKeyOldValues.set(syncKey, value);
				syncKeyNewValues.set(syncKey, newValue);
				syncedProp._skipHasChanged = true;
				store.set(key, newValue);
				requestUpdateOnChange(key, { value: newValue });
			}
		}
		syncedProp._skipHasChanged = false;
		return newValue !== syncKeyOldValues.get(syncKey);
	};
}

function updateInstanceState(instance, attributeKey, storedValue, type) {
	instance.state[attributeKey] = storedValue;
	if (instance.updateAttribute) {
		instance.updateAttribute({
			key: attributeKey,
			value: storedValue,
			type,
			skipPropUpdate: true,
		});
	}
}

function getAttributeValue(instance, attributeKey, prop) {
	return (
		instance[attributeKey] ??
		instance.getAttribute(attributeKey) ??
		prop.defaultValue
	);
}

function handleInitialValue(
	instance,
	attributeKey,
	key,
	store,
	storedValue,
	attributeValue,
) {
	if (!isEmpty(attributeValue) && isEmpty(storedValue)) {
		store.set(key, attributeValue);
		instance.state[attributeKey] = attributeValue;
	}
}

const requestUpdateOnChange = (changedKey, opts = {}) => {
	const { value: newValue, filter } = opts;
	syncKeyMap.forEach((instances, syncKey) => {
		const [key, adapter] = syncKey.split(SYNC_KEY_SEPARATOR);
		if (opts.isUrl && !["url", "querystring", "hash"].includes(adapter)) {
			return;
		}
		if (opts.isUrl || key === changedKey) {
			const prop = syncKeyProps.get(syncKey) || {};
			const attributeKey = prop.attributeKey;

			if (opts.isUrl && !syncKeyNewValues.has(syncKey)) {
				syncKeyNewValues.set(
					syncKey,
					self.APP.Controller[adapter].get(syncKey)?.value,
				);
				syncKeyOldValues.set(syncKey, [...instances][0][attributeKey]);
			}

			let value = newValue ?? syncKeyNewValues.get(syncKey);
			const oldValue = syncKeyOldValues.get(syncKey);
			if (opts.isUrl && !value) {
				value = self.APP.Controller[adapter].get(key)?.value;
			}

			if (value) {
				instances.forEach((instance) => {
					let instanceKey = attributeKey;
					if (filter && !attributeKey)
						instanceKey = [changedKey, filter].join(":");

					const derivedProps = syncKeyDerived.get(instance)?.get(changedKey);
					if (derivedProps) {
						Object.entries(derivedProps).forEach(
							([derivedKey, derivedFilter]) => {
								const derivedValue = Array.isArray(value)
									? value.find((v) => v[derivedFilter] === true)
									: value[derivedFilter];

								updateInstance(
									instance,
									derivedKey,
									derivedValue,
									oldValue,
									value,
								);
							},
						);
					} else {
						updateInstance(instance, instanceKey, value, oldValue, value);
					}
				});
			}

			syncKeyNewValues.delete(syncKey);
			syncKeyOldValues.delete(syncKey);
		}
	});
};

const updateInstance = (instance, key, newValue, oldValue, value) => {
	const updatedProp =
		instance.constructor.properties[key] ||
		Object.values(instance.constructor.properties).find((p) => p.key === key);

	if (updatedProp) {
		updatedProp._skipHasChanged = true;

		if (!isEqual(oldValue, newValue)) {
			if (instance.updateAttribute) {
				instance.updateAttribute({
					key,
					value: newValue ?? value,
				});
			}

			instance[key] = newValue ?? value;
		}
	}
};

window.addEventListener("popstate", (event) =>
	requestUpdateOnChange(event, { isUrl: true }),
);

window.addEventListener("ramStorageChange", (event) =>
	requestUpdateOnChange(event.detail.key, {
		value: event.detail.value,
	}),
);

window.addEventListener("storage", (event) => {
	if (
		event.storageArea === self.APP.Controller.local ||
		event.storageArea === self.APP.Controller.session
	) {
		requestUpdateOnChange(event);
	}
});

APP.add(View, { library: "View" });

})();
await (async () => {
const { APP } = self;
const { View } = APP;

// Permission types
const PermissionTypes = {
	LOCATION: "location",
	CAMERA: "camera",
	MICROPHONE: "microphone",
	NOTIFICATIONS: "notifications",
};

const PermissionStatus = {
	UNKNOWN: "unknown",
	GRANTED: "granted",
	DENIED: "denied",
	PROMPT: "prompt",
};

// Permission handlers
const permissionHandlers = {
	[PermissionTypes.LOCATION]: {
		request: () =>
			new Promise((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(
					() => resolve(PermissionStatus.GRANTED),
					() => reject(PermissionStatus.DENIED),
				);
			}),
		getData: () =>
			new Promise((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(
					(position) =>
						resolve({
							lat: position.coords.latitude,
							lng: position.coords.longitude,
						}),
					(error) => reject(error),
				);
			}),
	},
	[PermissionTypes.CAMERA]: {
		request: async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: true,
				});
				stream.getTracks().forEach((track) => track.stop());
				return PermissionStatus.GRANTED;
			} catch (error) {
				return PermissionStatus.DENIED;
			}
		},
		getData: async () => {
			try {
				const devices = await navigator.mediaDevices.enumerateDevices();
				return devices.filter((device) => device.kind === "videoinput");
			} catch (error) {
				console.error("Error getting camera data:", error);
				return null;
			}
		},
	},
	[PermissionTypes.MICROPHONE]: {
		request: async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				stream.getTracks().forEach((track) => track.stop());
				return PermissionStatus.GRANTED;
			} catch (error) {
				return PermissionStatus.DENIED;
			}
		},
		getData: async () => {
			try {
				const devices = await navigator.mediaDevices.enumerateDevices();
				return devices.filter((device) => device.kind === "audioinput");
			} catch (error) {
				console.error("Error getting microphone data:", error);
				return null;
			}
		},
	},
	[PermissionTypes.NOTIFICATIONS]: {
		request: async () => {
			try {
				const permission = await Notification.requestPermission();
				return permission === "granted"
					? PermissionStatus.GRANTED
					: PermissionStatus.DENIED;
			} catch (error) {
				return PermissionStatus.DENIED;
			}
		},
		getData: () => {
			return {
				permission: Notification.permission,
			};
		},
	},
};

const request = async (type, updateFn) => {
	if (!permissionHandlers[type]) {
		throw new Error(`Unsupported permission type: ${type}`);
	}
	try {
		const status = await permissionHandlers[type].request();
		const data = await getPermissionData(type);
		if (updateFn) updateFn(data);
		return { data, status };
	} catch (error) {
		console.error(`Error requesting ${type} permission:`, error);
		return PermissionStatus.DENIED;
	}
};

const getPermissionData = async (type) => {
	if (!permissionHandlers[type]) {
		throw new Error(`Unsupported permission type: ${type}`);
	}
	try {
		const data = await permissionHandlers[type].getData();
		return data;
	} catch (error) {
		console.error(`Error getting ${type} data:`, error);
		return null;
	}
};

const PermissionLibrary = {
	PermissionTypes,
	PermissionStatus,
	request,
};

APP.add(PermissionLibrary, { library: "Permission" });

})();
await (async () => {
self.APP.add(
	{ BASE_PATH: "", DEV_SERVER: "http://localhost:8111" },
	{ prop: "config" },
);

})();
await (async () => {
(() => {
	const { T } = self.APP;

	const models = {
		users: {
			username: T.string({ primary: true }),
			email: T.string({ unique: true }),
			role: T.string({
				defaultValue: "user",
				enum: ["admin", "user", "provider"],
			}),
			language: T.string({ defaultValue: "en", enum: ["en", "pt", "es"] }),
			avatar: T.string(),
			whatsappNumber: T.string(),
			stories: T.many("stories", "user"),
		},
		meetups: {
			name: T.string(),
			description: T.string(),
			startDate: T.date(),
			endDate: T.date(),
			location: T.string(),
			maxParticipants: T.number(),
			category: T.one("categories", "meetups"),
			organizer: T.one("users", "meetups"),
			attendees: T.many("users", "meetups"),
			images: T.array(),
			status: T.string({
				enum: ["draft", "published", "cancelled", "completed"],
				defaultValue: "draft",
			}),
			cost: T.number({ defaultValue: 0 }),
			meetingLink: T.string(),
			requirements: T.array(),
			public: T.boolean({ defaultValue: true }),
		},
		categories: {
			name: T.string({ primary: true }),
			type: T.string({ enum: ["event", "place"] }),
			description: T.string(),
			category: T.one("categories", "meetups"),
			content: T.many("content", "category"),
			events: T.many("events", "category"),
			places: T.many("places", "category"),
		},
		places: {
			name: T.string(),
			description: T.array(),
			category: T.string({
				enum: [
					"foodie",
					"sports",
					"hikes",
					"parties",
					"bars",
					"tours",
					"dancing",
					"whatsapp",
				],
				index: true,
			}),
			reviews: T.many("reviews", "place"),
			events: T.many("events", "place"),
			stories: T.many("stories", "place"),
			address: T.string(),
			phoneNumber: T.string(),
			coordinates: T.object(),
			openingHours: T.array(),
			images: T.array(),
			rating: T.number(),
			reviewCount: T.number(),
			priceRange: T.string(),
			website: T.string(),
			menu: T.string(),
			amenities: T.array(),
			recommendations: T.array(),
			attributes: T.array(),
			businessStatus: T.string(),
			priceLevel: T.string(),
			editorialSummary: T.string(),
			reservation: T.object(),
			menuUrl: T.string(),
			orderUrl: T.string(),
		},
		events: {
			name: T.string(),
			description: T.string(),
			startDate: T.date(),
			endDate: T.date(),
			stories: T.many("stories", "place"),
			place: T.one("places", "events"),
			category: T.one("categories", "events"),
			cost: T.number(),
			organizer: T.string(),
			images: T.array(),
			reviews: T.many("reviews", "event"),
		},
		reviews: {
			content: T.string(),
			public: T.boolean({ defaultValue: false, index: true }),
			liked: T.boolean({ defaultValue: false, index: true }),
			user: T.one("users", "reviews"),
			place: T.one("places", "reviews"),
			stories: T.many("stories", "event"),
			event: T.one("events", "reviews"),
			itemType: T.string({
				enum: ["events", "places"],
				index: true,
			}),
		},
		content: {
			category: T.one("categories", "content"),
			name: T.string(),
			content: T.string(),
		},
		stories: {
			title: T.string(),
			type: T.string({ enum: ["image", "video", "text"] }),
			contentUrl: T.string(),
			text: T.string(),
			expirationDate: T.date(),
			place: T.one("places", "stories"),
			event: T.one("events", "stories"),
			createdAt: T.date(),
		},
		notifications: {
			type: T.string({
				enum: ["event", "place", "general", "story"],
			}),
			title: T.string(),
			message: T.string(),
			read: T.boolean({ defaultValue: false }),
		},
	};

	APP.add(models, { prop: "models" });

	self.APP.add({ BASE_URL: "http://localhost:1313" }, { prop: "config" });
})();

})();
await (async () => {
const { T, html } = self.APP;

const routes = {
	"/": {
		component: () => html`<rio-home full></rio-home>`,
		title: "MEETUP.RIO",
		template: "rio-template",
	},

	"/meetups": {
		component: () =>
			html`<rio-list entity="meetup" data-model="meetups"></rio-list>`,
		title: "Meetups",
		template: "rio-template",
	},
	"/meetups/:category": {
		component: ({ category }) =>
			html`<rio-list data-model="meetups" entity="meetup" data-category=${category}></rio-list>`,
		title: "Meetups by Category",
		template: "rio-template",
	},
	"/meetup/:id": {
		component: ({ id }) =>
			html`<rio-item data-model="meetups" data-id=${id}></rio-item>`,
		title: "Meetup Details",
		template: "rio-template",
	},
	"/meetup/new": {
		component: () => html`<rio-meetup-new></rio-meetup-new>`,
		title: "Create New Meetup",
		template: "rio-template",
	},
	"/events": {
		component: () =>
			html`<rio-list entity="event" data-model="events"></rio-list>`,
		title: "Events",
		template: "rio-template",
	},
	"/events/:category": {
		component: ({ category }) =>
			html`<rio-list data-model="events" entity="event" data-category=${category}></rio-list>`,
		title: "Events by Category",
		template: "rio-template",
	},
	"/event/:id": {
		component: ({ id }) =>
			html`<rio-item data-model="events" data-id=${id}></rio-item>`,
		title: "Event Details",
		template: "rio-template",
	},
	"/places": {
		component: () =>
			html`<rio-list entity="place" data-model="places"></rio-list>`,
		title: "Places",
		template: "rio-template",
	},
	"/places/:category": {
		component: ({ category }) =>
			html`<rio-list data-model="places" entity="place" data-category=${category}></rio-list>`,
		template: "rio-template",
	},
	"/place/:id": {
		component: ({ id }) =>
			html`<rio-item data-model="places" entity="place" data-id=${id}></rio-item>`,
		title: "Place Details",
		template: "rio-template",
	},
	"/reviews/:id": {
		component: ({ id }) => html`<rio-reviews itemId=${id}></rio-reviews>`,
		title: "Reviews",
		template: "rio-template",
	},
	"/likes": {
		component: () =>
			html`<rio-list data-model="reviews" entity="review" data-include=${["event", "place", "activity"]}></rio-list>`,
		title: "Likes",
		template: "rio-template",
	},
	"/nearby": {
		component: () =>
			html`<rio-nearby-filter data-model="places" filters=${[1, 3, 5, 10]}></rio-nearby-filter>`,
		title: "Nearby",
		template: "rio-template",
	},
	"/notifications": {
		component: () =>
			html`<rio-notifications data-model="notifications"></rio-notifications>`,
		title: "Notifications",
		template: "rio-template",
	},
};

self.APP.add(routes, { prop: "routes" });
self.APP.add(
	{ "uix-link-text-color": "var(--color-default-95)" },
	{ prop: "theme" },
);
self.APP.Assets.add("map.png", "extensions/rio/map.png", "image");

})();
await (async () => {
const { APP } = self;
const { Controller, helpers } = self.APP;
const { ram } = Controller;
const { render } = helpers;

class Router {
	static stack = [];
	static routes = {};

	static init(routes, defaultTitle) {
		if (Object.keys(routes).length === 0) {
			return console.error("Error: no routes loaded");
		}
		this.routes = routes;
		this.defaultTitle = defaultTitle;

		// Add popstate event listener for browser back/forward
		window.addEventListener("popstate", (event) => {
			const currentPath = window.location.pathname + window.location.search;
			this.handleHistoryNavigation(currentPath);
		});

		this.setCurrentRoute(
			window.location.pathname + window.location.search,
			true,
		);
	}

	static handleHistoryNavigation(path) {
		// Find the index of this path in our stack
		const stackIndex = this.stack.findIndex(
			(item) => this.normalizePath(item.path) === this.normalizePath(path),
		);

		if (stackIndex !== -1) {
			// Path exists in stack - truncate to this point
			this.truncateStack(stackIndex);
			const matched = this.matchRoute(path);
			if (matched) {
				this.currentRoute = matched;
				this.updateCurrentRouteInRam(this.currentRoute);
			}
		} else {
			// New path - add to stack
			this.setCurrentRoute(path, true);
		}
	}

	static go(path) {
		this.setCurrentRoute(path, true);
	}

	static push(path) {
		window.history.pushState({}, "", path);
	}

	static home() {
		this.stack = [];
		this.go("/");
	}

	static back() {
		if (this.stack.length <= 1) {
			this.home();
			return;
		}

		this.stack = this.stack.slice(0, -1);
		const { path } = this.stack.at(-1);
		window.history.back(); // Use browser's back instead of manual navigation
	}

	static pushToStack(path, params = {}, title = this.defaultTitle) {
		if (path === "/") {
			this.stack = [];
		} else {
			this.stack.push({ path, params, title });
		}
	}

	static isRoot() {
		return this.stack.length === 0;
	}

	static truncateStack(index = 0) {
		if (index < this.stack.length) {
			this.stack = this.stack.slice(0, index + 1);
		}
	}

	static normalizePath(path) {
		const normalized = path.split("?")[0].replace(/\/+$/, "");
		return normalized || "/";
	}

	static setCurrentRoute(path, pushToStack = true) {
		if (!this.routes) return;

		const normalizedPath = this.normalizePath(path);
		const matched = this.matchRoute(normalizedPath);

		if (matched) {
			this.currentRoute = matched;
			if (pushToStack) {
				this.pushToStack(
					normalizedPath,
					matched.params,
					matched.route.title || this.defaultTitle,
				);
				window.history.pushState({ path: normalizedPath }, "", path);
			}
			this.updateCurrentRouteInRam(this.currentRoute);
		} else {
			this.go("/");
		}
	}

	static matchRoute(url) {
		const path = url.split("?")[0];
		if (this.routes[path]) {
			return { route: this.routes[path], params: {}, path };
		}

		for (const routePath in this.routes) {
			const paramNames = [];
			const regexPath = routePath.replace(/:([^/]+)/g, (_, paramName) => {
				paramNames.push(paramName);
				return "([^/]+)";
			});
			const regex = new RegExp(`^${regexPath.replace(/\/+$/, "")}$`);
			const match = path.match(regex);

			if (match) {
				const params = {};
				paramNames.forEach((name, index) => {
					params[name] = match[index + 1];
				});
				return { route: this.routes[routePath], params, path };
			}
		}
		return null;
	}

	static setTitle(newTitle) {
		document.title = newTitle;
		if (this.stack.length > 0) {
			this.stack.at(-1).title = newTitle;
			this.currentRoute.route.title = newTitle;
			ram.set("currentRoute", { ...this.currentRoute });
		}
	}

	static updateCurrentRouteInRam(route) {
		if (route) {
			route.root = this.isRoot();
			ram.set("currentRoute", route);
		}
	}
}

const init = () => {
	Router.init(self.APP.routes);
};

APP.add([init], { prop: "init" });
APP.add(Router, { library: "Router" });

})();
await (async () => {

})();
await (async () => {

})();
await (async () => {

})();
await (async () => {
(() => {
	const { T } = self.APP;
	const models = {
		files: {
			name: T.string(),
			directory: T.string(),
			path: T.string({
				index: true,
				derived: (file) => `${file.directory}${file.name}`,
			}),
			kind: T.string({ enum: ["file", "directory"] }),
			filetype: T.string({ defaultValue: "plain/text" }),
			content: T.string(),
		},
	};
	self.APP.add(models, { prop: "models" });
})();

})();
await (async () => {

})();
await (async () => {
(() => {
	const { T } = self.APP;
	const models = {
		users: {
			username: T.string({ primary: true }),
			email: T.string({ unique: true }),
			role: T.string({ defaultValue: "user", enum: ["admin", "user"] }),
		},
		boards: {
			name: T.string(),
			description: T.string(),
			tasks: T.many("tasks", "boardId"),
		},
		tasks: {
			title: T.string(),
			description: T.string(),
			completed: T.boolean({ defaultValue: false }),
			dueDate: T.date(),
			priority: T.string({
				defaultValue: "medium",
				enum: ["low", "medium", "high"],
			}),
			boardId: T.one("boards", "tasks"),
			createdBy: T.one("users", "tasks"),
			assignedTo: T.one("users", "assignedTasks"),
			comments: T.array(),
		},
	};

	self.APP.add(models, { prop: "models" });
})();

})();
await (async () => {

})();
await (async () => {

})();
await (async () => {
const { APP } = self;
const { html } = APP;

const routes = {
	"/admin": {
		component: () => html`<data-ui path="admin/data"></data-ui>`,
		title: "Admin",
		template: "admin-template",
	},
	"/admin/data": {
		component: () => html`<data-ui path="admin/data"></data-ui>`,
		title: "Data",
		template: "admin-template",
	},
	"/admin/design": {
		component: () => html`<design-ui></design-ui>`,
		title: "Design",
		template: "admin-template",
	},
	"/admin/design/:component": {
		component: ({ component }) =>
			!console.log({ component }) &&
			html`<design-ui component=${component}></design-ui>`,
		title: "Component Design",
		template: "admin-template",
	},
	"/admin/data/:model": {
		component: ({ model }) =>
			html`<data-ui path="admin/data" data-model=${model}></data-ui>`,
		title: "Admin",
		template: "admin-template",
	},
};

APP.add(routes, { prop: "routes" });

})();
await (async () => {

})();
await (async () => {
const mv3events = {
	PLACE_LIST_DATA: (message, popup) => {
		const { queryTitle, places } = message.data;
		console.log(popup);
		chrome.storage.local.get([queryTitle], (result) => {
			const existingPlaces = result[queryTitle] || [];
			let newPlacesAdded = 0;

			places.forEach((place) => {
				if (
					!existingPlaces.some(
						(existingPlace) => existingPlace.placeId === place.placeId,
					)
				) {
					existingPlaces.push(place);
					newPlacesAdded++;
				}
			});

			chrome.storage.local.set({ [queryTitle]: existingPlaces }, () => {
				console.log(
					`Updated place list for "${queryTitle}". Total places: ${existingPlaces.length}, New places added: ${newPlacesAdded}`,
				);
				popup.placesCount += newPlacesAdded;
				popup.requestUpdate("placesCount", popup.placesCount - newPlacesAdded);
			});
		});
	},
};

self.APP.add(mv3events, { prop: "mv3events" });

})();
await (async () => {
(() => {
	const { T } = self.APP;

	const models = {
		/* Core User and Group Models - Shared between both systems */
		users: {
			phoneNumber: T.string({ primary: true }),
			name: T.string(),
			status: T.string({
				enum: ["pending", "active", "blocked"],
				defaultValue: "pending",
				index: true,
			}),
			rank: T.number({ defaultValue: 1 }),
			lastActivity: T.date(),
			createdAt: T.date(),
			joinedAt: T.date(),
			groups: T.many("groupMembers", "user"),
			messages: T.many("messages", "sender"),
			reactions: T.many("reactions", "user"),
			receivedReactions: T.many("reactions", "targetUser"),

			// Settings
			settings: T.object({
				defaultValue: {
					notifications: true,
					timezone: "UTC",
				},
			}),

			// Analytics fields
			karmaPoints: T.number({ defaultValue: 0 }),
		},

		groups: {
			groupId: T.string({ primary: true }),
			name: T.string(),
			inviteLink: T.string(),
			description: T.string(),
			createdAt: T.date(),
			lastActivity: T.date(),
			members: T.many("groupMembers", "group"),
			messages: T.many("messages", "group"),
			events: T.many("events", "group"),
			settings: T.object({
				defaultValue: {
					commandsEnabled: true,
					adminOnly: false,
					language: "en",
					karmaEnabled: true,
				},
			}),
		},

		groupMembers: {
			id: T.string({ primary: true }),
			group: T.one("groups", "members"),
			user: T.one("users", "groups"),
			role: T.string({
				enum: ["member", "admin"],
				defaultValue: "member",
				index: true,
			}),
			status: T.string({
				enum: ["active", "left", "removed"],
				defaultValue: "active",
				index: true,
			}),
			joinedAt: T.date(),
			leftAt: T.date(),
		},

		commands: {
			name: T.string({ primary: true }),
			description: T.string(),
			config: T.object({
				defaultValue: {
					requiresAuth: false,
					adminOnly: false,
					groupEnabled: true,
					privateEnabled: true,
				},
			}),
			usageCount: T.number({ defaultValue: 0 }),
			lastUsed: T.date(),
		},

		commandContexts: {
			id: T.string({ primary: true }),
			command: T.string(),
			user: T.one("users", "commandContexts"),
			group: T.one("groups", "commandContexts", { optional: true }),
			state: T.object({
				defaultValue: {
					step: 0,
					collectedData: {},
					expectedInput: null,
					validation: null,
				},
			}),
			createdAt: T.date(),
			expiresAt: T.date(),
			status: T.string({
				enum: ["active", "completed", "expired", "cancelled"],
				defaultValue: "active",
				index: true,
			}),
			messages: T.many("messages", "commandContext"),
		},

		/* Analytics System Specific Models */
		reactions: {
			id: T.string({ primary: true }),
			type: T.string(),
			timestamp: T.date({ index: true }),
			user: T.one("users", "reactions"),
			targetUser: T.one("users", "receivedReactions"),
			message: T.one("messages", "reactions"),
			karmaValue: T.number({ defaultValue: 1 }),
		},

		events: {
			id: T.string({ primary: true }),
			type: T.string({
				enum: ["join", "leave", "remove"],
				index: true,
			}),
			timestamp: T.date({ index: true }),
			user: T.one("users", "events"),
			group: T.one("groups", "events"),
			performedBy: T.one("users", "actionsPerformed", { optional: true }),
		},

		karmaRules: {
			id: T.string({ primary: true }),
			name: T.string(),
			action: T.string({
				enum: [
					"message_sent",
					"reaction_received",
					"daily_activity",
					"weekly_activity",
				],
			}),
			points: T.number(),
			active: T.boolean({ defaultValue: true }),
		},

		dailyStats: {
			id: T.string({ primary: true }),
			date: T.date({ index: true }),
			group: T.one("groups", "stats"),
			messageCount: T.number({ defaultValue: 0 }),
			activeUsers: T.number({ defaultValue: 0 }),
			reactionCount: T.number({ defaultValue: 0 }),
			newMembers: T.number({ defaultValue: 0 }),
			departedMembers: T.number({ defaultValue: 0 }),
			topPosters: T.array(),
			topReactions: T.array(),
			hourlyActivity: T.array({
				defaultValue: Array(24).fill(0),
			}),
		},

		/* Shared Message System - Used by both Command and Analytics */
		messages: {
			messageId: T.string({ primary: true }),
			type: T.string({
				enum: ["text", "image", "video", "audio", "document", "sticker"],
				index: true,
			}),
			body: T.string(),
			timestamp: T.date({ index: true }),
			sender: T.one("users", "messages"),
			group: T.one("groups", "messages", { optional: true }),

			// Command related
			isMe: T.boolean({ defaultValue: false, index: true }),
			isGroup: T.boolean({ defaultValue: false, index: true }),
			isCommand: T.boolean({ defaultValue: false, index: true }),
			command: T.string({ optional: true }),
			params: T.array({ defaultValue: [] }),
			parentMessage: T.one("messages", "childMessages", { optional: true }),
			childMessages: T.many("messages", "parentMessage"),
			commandContext: T.one("commandContexts", "messages", { optional: true }),

			// Processing
			status: T.string({
				enum: ["pending", "processing", "completed", "failed", "expired"],
				defaultValue: "pending",
				index: true,
			}),
			processedAt: T.date({ optional: true }),
			error: T.string({ optional: true }),

			// Analytics related
			deleted: T.boolean({ defaultValue: false }),
			reactions: T.many("reactions", "message"),
			replyCount: T.number({ defaultValue: 0 }),

			// Metadata
			metadata: T.object({
				defaultValue: {
					media: null,
					quotedMessage: null,
					mentions: [],
					buttons: null,
					location: null,
				},
			}),
		},
	};

	APP.add(models, { prop: "models" });
	self.APP.add({ BASE_URL: "http://localhost:1313" }, { prop: "config" });
})();

})();
self.APP.Icons = {"bell":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m4.3 13a1.94 1.94 0 0 0 3.4 0\"/></svg>","menu":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M4 12h16M4 6h16M4 18h16\"/></svg>","utensils":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20m14-7V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2zm0 0v7\"/></svg>","dumbbell":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M14.4 14.4L9.6 9.6m9.057 11.885a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829zm2.843.015l-1.4-1.4M3.9 3.9L2.5 2.5m3.904 10.268a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z\"/></svg>","mountain":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m8 3l4 8l5-5l5 15H2z\"/></svg>","music":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M9 18V5l12-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"18\" cy=\"16\" r=\"3\"/></g></svg>","wine":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M8 22h8M7 10h10m-5 5v7m0-7a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5\"/></svg>","map":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0zm.894.211v15M9 3.236v15\"/></svg>","drum":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m2 2l8 8m12-8l-8 8\"/><ellipse cx=\"12\" cy=\"9\" rx=\"10\" ry=\"5\"/><path d=\"M7 13.4v7.9m5-7.3v8m5-8.6v7.9M2 9v8a10 5 0 0 0 20 0V9\"/></g></svg>","message-circle":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M7.9 20A9 9 0 1 0 4 16.1L2 22Z\"/></svg>","house":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/></g></svg>","calendar":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M8 2v4m8-4v4\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M3 10h18\"/></g></svg>","circle-plus":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M8 12h8m-4-4v8\"/></g></svg>","heart":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2c-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"/></svg>","user":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/></g></svg>","sun":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41\"/></g></svg>","chevron-left":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m15 18l-6-6l6-6\"/></svg>","map-pin":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/></g></svg>","star":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m12 2l3.09 6.26L22 9.27l-5 4.87l1.18 6.88L12 17.77l-6.18 3.25L7 14.14L2 9.27l6.91-1.01z\"/></svg>","clock":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 6v6l4 2\"/></g></svg>","plus":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M5 12h14m-7-7v14\"/></svg>","heart-pulse":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2c-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"/><path d=\"M3.22 12H9.5l.5-1l2 4.5l2-7l1.5 3.5h5.27\"/></g></svg>","eye-off":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575a1 1 0 0 1 0 .696a10.8 10.8 0 0 1-1.444 2.49m-6.41-.679a3 3 0 0 1-4.242-4.242\"/><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 4.446-5.143M2 2l20 20\"/></g></svg>","eye":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></g></svg>","moon":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 3a6 6 0 0 0 9 9a9 9 0 1 1-9-9\"/></svg>","thumbs-up":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M7 10v12m8-16.12L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88\"/></svg>"};
await (async () => {
const { View, html, T } = window.APP;

class NotificationsListPage extends View {
	static properties = {
		"data-model": T.string(),
		collection: T.object(),
		loading: T.boolean(),
		error: T.string(),
	};

	render() {
		const { items } = this.collection || {};
		return !items
			? null
			: html`
        <uix-container padding="lg" grow overflow="auto" gap="md">
          ${
						this.loading
							? html`<uix-spinner></uix-spinner>`
							: this.error
								? html`<uix-text color="error">${this.error}</uix-text>`
								: items?.length
									? items.map(
											(item) => html`
                        <uix-card padding="md" margin="sm">
                          <uix-container vertical gap="sm">
                            <uix-text size="lg" weight="bold">${item.title}</uix-text>
                            <uix-text size="sm">${item.message}</uix-text>
                            <uix-container horizontal justify="space-between">
                              <uix-text size="sm">
                                <uix-icon name="bell"></uix-icon>
                                ${item.type}
                              </uix-text>
                              <uix-text size="sm">
                                <uix-icon name="eye${item.read ? "" : "-off"}"></uix-icon>
                                ${item.read ? "Read" : "Unread"}
                              </uix-text>
                            </uix-container>
                          </uix-container>
                        </uix-card>
											`,
										)
									: html`<uix-text>No notifications found.</uix-text>`
					}
        </uix-container>
      `;
	}
}

NotificationsListPage.register("rio-notifications");

})();
await (async () => {
const { APP } = self;
const { T, View, helpers } = APP;
const { staticHTML: html } = helpers;
class UIXFormControl extends View {
	static properties = {
		type: T.string({ defaultValue: "input" }),
		name: T.string(),
		value: T.string(),
		placeholder: T.string(),
		rows: T.number(),
		options: T.array(),
		color: T.string(),
		size: T.string(),
		label: T.string(),
		icon: T.string(),
		autofocus: T.boolean(),
		disabled: T.boolean(),
		required: T.boolean(),
		validate: T.function(),
		retrieve: T.function(),
	};

	static formAssociated = true;

	formResetCallback() {
		const $input = this.getInput();
		if (!["submit", "button", "reset"].includes($input.type))
			$input.value = this._defaultValue || "";
		if (["radio", "checkbox", "switch"].includes($input.type))
			$input.checked = this._defaultValue || false;
	}

	formDisabledCallback(disabled) {
		const $input = this.getInput();
		if ($input) $input.disabled = disabled;
	}

	formStateRestoreCallback(state) {
		const $input = this.getInput();
		if ($input) $input.value = state;
	}
	reportValidity() {
		const $input = this.getInput();
		const validity = $input?.reportValidity() !== false;
		$input?.classList.toggle("input-error", !validity);
		return validity;
	}

	async change(e) {
		this.value = e.target ? e.target.value : e;
		if (this.validate) {
			const isValid = this.validate(this.value);
			if (!isValid) {
				this.reportValidity();
				console.error("Validation failed");
			} else {
				console.log("Validation succeeded");
			}

			if (this.retrieve && isValid) {
				const formData = this.parentNode.formData();
				await this.retrieve({
					value: this.value,
					formData,
					update: this.parentNode.updateFields.bind(this.parentNode),
				});
			}
		}
	}

	getInput() {
		if (!this.$input) {
			this.$input = this.querySelector("input, select, textarea");
			if (this.$input) {
				this._internals.setValidity(
					this.$input.validity,
					this.$input.validationMessage,
					this.$input,
				);
			}
		}
		return this.$input;
	}

	async connectedCallback() {
		super.connectedCallback();
		this._defaultValue = this.value;
		if (!this._internals) {
			this._internals = this.attachInternals();
		}
	}

	render() {
		const { type = "input" } = this;

		const formControlTypes = {
			input: "uix-input",
			textarea: "uix-textarea",
			select: "uix-select",
			boolean: "uix-checkbox",
		};

		const tagName = formControlTypes[type] || formControlTypes.input;

		return html`
      <${helpers.unsafeStatic(tagName)}
        ?autofocus=${this.autofocus}
        ?disabled=${this.disabled}
        ?required=${this.required}
        value=${this.value}
        .change=${this.change?.bind(this)}
        .input=${this.change?.bind(this)}
        .keydown=${this.change?.bind(this)}
        .rows=${this.rows}
        .options=${this.options}
        name=${this.name}
				placeholder=${this.placeholder}
        color=${this.color}
        size=${this.size}
        label=${this.label || this.name}
        icon=${this.icon}
      ></${helpers.unsafeStatic(tagName)}>
    `;
	}
}

UIXFormControl.register("uix-form-control", true);

})();
await (async () => {
const { APP } = self;
const { View, T, html } = APP;

class CrudForm extends View {
	static properties = {
		icon: T.string(),
		item: T.object(),
		onclose: T.function(),
		props: T.object(),
		onsubmit: T.function(),
	};
	handleSubmit() {
		const form = this.q("uix-form");
		const data = form.formData();
		const valid =
			form.validate() && (!this.onsubmit || this.onsubmit(data) === true);

		if (valid) {
			if (this.item) {
				data.id = this.item.id;
			}
			this.model[data.id ? "edit" : "add"](data);
			form.reset();
			this.onclose?.();
		}
	}

	removeRowAndCloseModal() {
		this.model.remove();
		this.onclose?.();
	}

	render() {
		const { item } = this;
		const { model, id } = this.dataset;
		const columns = this.props || this.model?.props || {};
		const isUpdate = !!id;
		return html`<uix-form
            title=${isUpdate ? "Update" : "New"}
            color="base"
						.handleSubmit=${this.handleSubmit.bind(this)}
            id=${model + (isUpdate ? "-update-form" : "-new-form")}
            size="md"
            name="uixCRUDForm"
          >
            ${Object.keys(columns).map((columnKey) => {
							const field = columns[columnKey];
							return html`<uix-form-control
                  type=${
										field.type?.name
											? field.type.name.toLowerCase()
											: field.type || "input"
									}
                  .validate=${field.validate}
                  .retrieve=${field.retrieve}
                  .name=${columnKey}
                  .label=${field.label}
                  value=${this.dataset[columnKey] ?? (item ? item[columnKey] : field.value)}
                  .placeholder=${field.placeholder}
                  .rows=${field.rows}
                  .options=${field.options}
                  .color=${field.color}
                  .size=${field.size}
                  .icon=${field.icon}
                  ?autofocus=${field.autofocus}
                  ?disabled=${field.disabled}
                  ?required=${field.required}
                ></uix-form-control>`;
						})}

            <uix-container horizontal justify="space-between" gap="md">
              ${
								isUpdate
									? html`<uix-button
                    slot="cta"
                    variant="error"
                    @click=${this.removeRowAndCloseModal.bind(this)}
                    label="Remove"
                  >
                  </uix-button>`
									: null
							}

              <uix-button
                slot="cta"
                type="submit"
                label=${isUpdate ? `Update ${model}` : `Create ${model}`}
              >
              </uix-button>
            </uix-container>
          </uix-form>`;
	}
}

CrudForm.register("data-crud-form", true);

})();
await (async () => {
const { APP } = self;
const { View, T, html, Model } = APP;

const phoneNumber = "5521977276909";

class NewMeetup extends View {
	static properties = {
		formProps: T.object(),
		mapCropHeight: T.number({ sync: "ram" }),
	};

	constructor() {
		super();
		this.formProps = {
			name: {
				type: "input",
				label: "Meetup Name",
				required: true,
				placeholder: "Enter meetup name",
			},
			description: {
				type: "textarea",
				label: "Description",
				required: true,
				rows: 4,
				placeholder: "Describe your meetup",
			},
			startDate: {
				type: "datetime-local",
				label: "Start Date & Time",
				required: true,
			},
			location: {
				type: "input",
				label: "Location",
				required: true,
				placeholder: "Enter meetup location",
			},
			cost: {
				type: "number",
				label: "Cost",
				defaultValue: 0,
				placeholder: "Enter cost per person",
			},
			public: {
				type: "checkbox",
				label: "Make this meetup public?",
				defaultValue: true,
			},
			images: {
				type: "file",
				label: "Upload Images",
				multiple: true,
				accept: "image/*",
			},
		};
	}

	firstUpdated() {
		this.mapCropHeight = 120;
		this.shouldUpdate("mapCropHeight", 320);
	}

	async handleSubmit(data) {
		const text = JSON.stringify({ action: "NEW_MEETUP", data });
		const whatsappLink = `https://wa.me/${phoneNumber}?text=${text}`;

		window.location.href = whatsappLink;
	}

	render() {
		return html`
      <uix-card>
        <data-crud-form
          data-model="meetups"
          .props=${this.formProps}
          .onsubmit=${this.handleSubmit.bind(this)}
        ></data-crud-form>
      </uix-card>
    `;
	}
}

NewMeetup.register("rio-meetup-new");

})();
await (async () => {
const { APP } = self;
const { T, View, html, helpers, theme } = APP;

class Checkbox extends View {
	static element = "checkbox";
	static theme = {
		size: (entry) => ({
			"--uix-checkbox-width": helpers.getSize(entry, "0.1"),
			"--uix-checkbox-height": helpers.getSize(entry, "0.1"),
		}),
		variant: (entry) => ({
			accent: `var(--color-${entry}-60)`,
			background: `var(--color-${entry}-60)`,
			border: `var(--color-${entry}-60)`,
		}),
	};
	static properties = {
		name: T.string(),
		variant: T.string({
			defaultValue: "default",
			enum: Object.keys(theme.colors),
		}),
		size: T.string({ defaultValue: "sm", enum: Object.keys(theme.sizes) }),
		checked: T.boolean(),
		value: T.boolean(),
		disabled: T.boolean(),
		change: T.function(),
	};

	firstUpdated() {
		super.firstUpdated();
		this.dispatchEvent(
			new CustomEvent("input-connected", {
				bubbles: true,
				composed: true,
			}),
		);
	}
	_onchange(e) {
		const { change } = this;
		change?.(e.target.checked);
	}
	render() {
		const { value, size, disabled, name, label, variant } = this;
		return html` <uix-container horizontal gap="md" items="center" full>
      <input
        class="uix-checkbox__element"
        type=${this.constructor.element}
        name=${name}
        id=${`uix-cb-${name}`}
        @change=${this._onchange}
        ?checked=${value}
        ?disabled=${disabled}
        variant=${variant}
        size=${size}
      />
      ${label ? html`<label for=${`uix-cb-${name}`}>${label}</label>` : null}
    </uix-container>`;
	}
}

Checkbox.register("uix-checkbox", true);

})();
await (async () => {
const { APP } = self;
const { T, View, html, theme } = APP;

class Textarea extends View {
	static properties = {
		value: T.string(),
		placeholder: T.string(),
		name: T.string(),
		disabled: T.boolean(),
		required: T.boolean(),
		autofocus: T.boolean(),
		rows: T.number({ defaultValue: 4 }),
		variant: T.string({
			defaultValue: "default",
		}),
		size: T.string({ defaultValue: "md", enum: Object.keys(theme.sizes) }),
		input: T.function(),
		keydown: T.function(),
	};

	static theme = {
		variant: (entry) => ({
			"--uix-textarea-background-color": `var(--color-${entry}-50)`,
			"--uix-textarea-border-color": `var(--color-${entry}-30)`,
			"--uix-textarea-focus-ring-color": `var(--color-${entry}-20)`,
			"--uix-textarea-focus-border-color": `var(--color-${entry}-60)`,
		}),
		size: (entry) => ({
			"--uix-textarea-width": `var(--size-${entry}, ${theme.sizes[entry]}px)`,
			"--uix-textarea-height": `var(--size-${entry}, ${theme.sizes[entry]}px)`,
		}),
	};

	firstUpdated() {
		super.firstUpdated();
		this.dispatchEvent(
			new CustomEvent("input-connected", {
				bubbles: true,
				composed: true,
			}),
		);
	}

	render() {
		const {
			autofocus,
			value,
			variant,
			name,
			placeholder,
			disabled,
			rows,
			required,
			keydown,
		} = this;
		return html`
      <textarea
        class="uix-textarea__input"
        placeholder=${placeholder}
        ?disabled=${disabled}
        name=${name}
        rows=${rows}
        variant=${variant}
        ?autofocus=${autofocus}
        ?required=${required}
        @input=${this.input}
        @keydown=${keydown}
      >
        ${value}
      </textarea
      >
    `;
	}
}

Textarea.register("uix-textarea", true);

})();
await (async () => {
const { APP } = self;
const { T, View } = APP;

class UIXForm extends View {
	static properties = {
		method: T.string({ defaultValue: "post" }),
		endpoint: T.string(),
		handleSubmit: T.function(),
	};

	getFormControls() {
		return this.querySelectorAll("uix-form-control");
	}

	validate() {
		const formControls = this.getFormControls();
		return [...formControls].every((control) => control.reportValidity());
	}

	async submit(event) {
		event.preventDefault();
		console.log("SUBMIT");
		if (this.handleSubmit) return this.handleSubmit();
		if (this.validate()) {
			const formData = this.formData();
			const response = await fetch(this.endpoint, {
				method: this.method,
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(formData),
			});

			if (!response.ok) {
				console.error("Form submission failed", response);
			}
		}
	}

	reset() {
		this.getFormControls().forEach((control) => control.formResetCallback?.());
	}

	formData() {
		const formData = Object.fromEntries(
			[...this.getFormControls()].map((element) => [
				element.name,
				element.value,
			]),
		);
		return formData;
	}

	connectedCallback() {
		super.connectedCallback();
		this.attachSubmitListener();
		this.addKeydownListener();
		this.addEventListener(`data-retrieved-${this.id}`, (event) =>
			this.updateFields(event.detail),
		);
	}

	attachSubmitListener() {
		const submitButton = this.querySelector('uix-button[type="submit"]');
		if (submitButton) {
			submitButton.addEventListener("click", this.submit.bind(this));
		}
	}

	addKeydownListener() {
		this.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				this.submit(event);
			}
		});
	}

	updateFields(data) {
		const formControls = this.getFormControls();
		Object.keys(data).forEach((key) => {
			const control = [...formControls].find((control) => control.name === key);
			if (control) {
				control.value = data[key];
			}
		});
	}
}

UIXForm.register("uix-form", true);

})();
await (async () => {
const { APP } = self;
const { View, T, html, Model } = APP;

const ItemTypeName = {
	events: "event",
	places: "place",
};
class Reviews extends View {
	static properties = {
		itemId: T.string(),
		itemType: T.string(),
		reviews: T.array(),
		userReview: T.object(),
	};

	async connectedCallback() {
		super.connectedCallback();
		this.itemTypeName = ItemTypeName[this.itemType];
		await this.loadReviews();
	}

	async loadReviews() {
		const { items } = await Model.reviews.getAllBy(
			this.itemTypeName,
			this.itemId,
		);
		this.reviews = items;
		this.userReview = items[0];
	}

	async toggleLike() {
		if (this.userReview) {
			this.userReview = await Model.reviews.edit({
				id: this.userReview.id,
				liked: !this.userReview.liked,
			});
		} else {
			this.userReview = await Model.reviews.add({
				[this.itemTypeName]: this.itemId,
				itemType: this.itemTypeName,
				liked: true,
				isPublic: false,
				content: "",
				createdAt: new Date(),
			});
		}

		await this.loadReviews();
	}

	async addOrUpdateReview(e) {
		e.preventDefault();
		const form = e.target;
		const content = form.content.value;
		const isPublic = form.isPublic.checked;

		if (this.userReview) {
			await Model.reviews.edit({
				id: this.userReview.id,
				content,
				isPublic,
			});
		} else {
			await Model.reviews.add({
				content,
				isPublic,
				liked: false,
				user: APP.user.id,
				itemType: this.itemTypeName,
				[this.itemTypeName]: this.itemId,
				createdAt: new Date(),
			});
		}

		await this.loadReviews();
		form.reset();
	}

	render() {
		const isLiked = this.userReview?.liked || false;

		return html`
      <uix-container vertical gap="md">
        <uix-button
          icon=${isLiked ? "heart-pulse" : "heart"}
          @click=${this.toggleLike.bind(this)}
          label=${isLiked ? "Unlike" : "Like"}
        ></uix-button>

        <uix-form @submit=${this.addOrUpdateReview.bind(this)}>
          <uix-textarea 
            name="content" 
            placeholder="Write your review" 
            .value=${this.userReview?.content || ""}
          ></uix-textarea>
          <uix-checkbox 
            name="isPublic" 
            label="Make review public"
            .checked=${this.userReview?.isPublic || false}
          ></uix-checkbox>
          <uix-button type="submit" label=${this.userReview ? "Update Review" : "Submit Review"}></uix-button>
        </uix-form>

        ${
					this.userReview && !this.userReview.isPublic
						? html`
          <uix-card>
            <uix-text size="lg" weight="bold">Your Private Review</uix-text>
            <uix-text>${this.userReview.content}</uix-text>
          </uix-card>
        `
						: null
				}

        <uix-text size="xl" weight="bold">Public Reviews</uix-text>
        ${this?.reviews?.map(
					(review) => html`
          <uix-card>
            <uix-text>${review.content}</uix-text>
            <uix-text size="sm" color="gray">${new Date(review.__metadata__.createdAt).toLocaleDateString()}</uix-text>
          </uix-card>
        `,
				)}
      </uix-container>
    `;
	}
}

Reviews.register("rio-reviews");

})();
await (async () => {
const { APP } = self;
const { View, html, T, Router } = APP;

class GenericDetailPage extends View {
	static properties = {
		"data-model": T.string(),
		entityType: T.string(),
		itemId: T.string(),
		item: T.object(),
		loading: T.boolean(),
		error: T.string(),
		mapCropHeight: T.number({ sync: "ram" }),
	};

	renderEventDetails(event) {
		return html`
      <uix-container vertical gap="md">
        <uix-text size="sm">
          <uix-icon name="calendar"></uix-icon>
          Start: ${new Date(event.startDate).toLocaleString()}
        </uix-text>
        <uix-text size="sm">
          <uix-icon name="calendar"></uix-icon>
          End: ${new Date(event.endDate).toLocaleString()}
        </uix-text>
        <uix-text size="sm">
          <uix-icon name="map-pin"></uix-icon>
          Location: ${event.location?.name || "Location TBA"}
        </uix-text>
        <uix-text size="sm">
          <uix-icon name="dollar-sign"></uix-icon>
          Cost: ${event.cost ? `$${event.cost}` : "Free"}
        </uix-text>
        <uix-text size="sm">
          <uix-icon name="user"></uix-icon>
          Organizer: ${event.organizer}
        </uix-text>
      </uix-container>
    `;
	}

	renderPlaceDetails(place) {
		return html`
      <uix-container vertical gap="md" style=${`background: src('${place.images[0]}');`}>
        <uix-button label="Meetup" icon="plus" href="/meetup/new"></uix-button>
        <uix-text size="sm">
          <uix-icon name="map-pin"></uix-icon>
          Address: ${place.address}
        </uix-text>
        <uix-text size="sm">
          <uix-icon name="star"></uix-icon>
          Rating: ${place?.rating?.toFixed(1)}
        </uix-text>
        <uix-text size="sm">
          <uix-icon name="clock"></uix-icon>
          Opening Hours: ${place?.openingHours?.join(", ")}
        </uix-text>
      </uix-container>
    `;
	}
	updated() {
		if (this.item) Router.setTitle(this.item.name);
	}

	firstUpdated() {
		this.mapCropHeight = 120;
	}

	render() {
		if (this.loading) return html`<uix-spinner></uix-spinner>`;
		if (this.error)
			return html`<uix-text color="error">${this.error}</uix-text>`;
		if (!this.item) return html`<uix-text>Item not found.</uix-text>`;
		return html`
      <uix-card padding="lg" margin="md">
        <uix-container padding="sm" grow overflow="auto">
          <uix-text size="md">${this.item.description}</uix-text>
          ${this.entityType === "events" ? this.renderEventDetails(this.item) : this.renderPlaceDetails(this.item)}
        </uix-container>

      <rio-reviews
            itemId=${this.item.id}
            itemType=${this.dataset.model}
          ></rio-reviews>
      </uix-card>
    `;
	}
}

GenericDetailPage.register("rio-item");

})();
await (async () => {
const { View, html, T, Router } = window.APP;

class GenericListPage extends View {
	static properties = {
		loading: T.boolean(),
		error: T.string(),
		mapCropHeight: T.number({ sync: "ram" }),
		entity: T.string(),
	};

	renderItem(item) {
		const itemImage = item?.images?.[2]?.url;
		return html`
      <uix-card padding="xs-sm" margin="sm"      
      style=${
				!itemImage
					? undefined
					: `        
        background: url('${itemImage}');
        background-size: cover; 
        background-position: center;  
        background-repeat: no-repeat;
        height: 150px;
        box-shadow: inset 0px 80px 30px -30px rgba(0, 0, 0, 0.7);
        position: relative;
        --background-color: transparent;
        --text-color: white;
        --uix-link-text-color: white;
        color: white;
      `
			}>
        <uix-container vertical gap="sm">
          <uix-link weight="bold" href=${`/${this.entity}/${item.id}`} label=${item.name || item[item.itemType]?.name}></uix-link>
          ${this.renderModelSpecificDetails(item)}
        </uix-container>
      </uix-card>
    `;
	}

	firstUpdated() {
		this.mapCropHeight = 120;
	}

	renderModelSpecificDetails(item) {
		const renderFunctions = {
			events: this.renderEventDetails,
			places: this.renderPlaceDetails,
			reviews: this.renderReviewDetails,
		};

		const renderFunction = renderFunctions[this.dataset.model];
		return renderFunction ? renderFunction(item) : null;
	}

	renderEventDetails = (event) => html`
    <uix-container horizontal justify="space-between">
      <uix-text size="sm">
        <uix-icon name="calendar"></uix-icon>
        ${new Date(event.startDate).toLocaleDateString()}
      </uix-text>
      <uix-text size="sm">
        <uix-icon name="map-pin"></uix-icon>
        ${event.place?.name || "Location TBA"}
      </uix-text>
    </uix-container>
    <uix-text size="sm">
      <uix-icon name="dollar-sign"></uix-icon>
      ${event.cost ? `$${event.cost}` : "Free"}
    </uix-text>
  `;

	renderPlaceDetails = (place) =>
		html`
    <uix-container horizontal justify="space-between">
      <uix-text size="xs">
        <uix-icon name="map-pin"></uix-icon>
        ${place.address}
      </uix-text>
      <uix-text size="xs">
        <uix-icon name="star"></uix-icon>
        ${(place.rating || 0).toFixed(1)}
      </uix-text>
    </uix-container>
  `;
	renderReviewDetails = (review) =>
		html`
    <uix-container horizontal justify="space-between">
      <uix-text size="sm">
        <uix-icon name="user"></uix-icon>
        ${review[review.itemType]?.name}
      </uix-text>
      <uix-text size="sm">
        <uix-icon name="calendar"></uix-icon>
        ${new Date(review.createdAt).toLocaleDateString()}
      </uix-text>
    </uix-container>
    <uix-text size="sm">
      <uix-icon name="thumbs-${review.liked ? "up" : "down"}"></uix-icon>
      ${review.liked ? "Liked" : "Not liked"}
    </uix-text>
  `;

	updated() {
		Router.setTitle(this.dataset.category?.toUpperCase());
	}

	render() {
		const { items } = this.collection || {};
		console.log(this.collection);
		return !items
			? null
			: html`
        <uix-container padding="lg" grow overflow="auto" gap="md">
          ${
						this.loading
							? html`<uix-spinner></uix-spinner>`
							: this.error
								? html`<uix-text color="error">${this.error}</uix-text>`
								: items?.length
									? items.map((item) => this.renderItem(item))
									: html`<uix-text>No ${this.dataset.model} found.</uix-text>`
					}
        </uix-container>
      `;
	}
}

GenericListPage.register("rio-list");

})();
await (async () => {
const { APP } = self;
const { T, View, html, theme, helpers } = APP;
const { getSize } = APP.helpers;

class Input extends View {
	static theme = {
		variant: (entry) => ({
			"--uix-input-background-color": `var(--color-${entry}-1)`,
			"--uix-input-border-color": `var(--color-${entry}-30)`,
			"--uix-input-text-color": `var(--color-${entry}-90)`,
		}),
		size: (entry) => ({
			"--uix-input-size": helpers.getSize(entry, "0.04"),
		}),
	};
	static properties = {
		bind: T.object(),
		autofocus: T.boolean(),
		value: T.string(),
		placeholder: T.string(),
		name: T.string(),
		label: T.string(),
		disabled: T.boolean(),
		regex: T.string(),
		required: T.boolean(),
		type: T.string({
			defaultValue: "text",
			enum: [
				"text",
				"password",
				"email",
				"number",
				"decimal",
				"search",
				"tel",
				"url",
			],
		}),
		maxLength: T.number(),
		variant: T.string({ defaultValue: "default" }),
		size: T.string({ defaultValue: "md", enum: Object.keys(theme.sizes) }),
		keydown: T.function(),
		change: T.function(),
		input: T.function(),

		checkbox: T.boolean(),
		radio: T.boolean(),
	};

	firstUpdated() {
		super.firstUpdated();
		this.dispatchEvent(
			new CustomEvent("input-connected", {
				bubbles: true,
				composed: true,
			}),
		);

		// Generate unique name and id if not provided
		if (!this.name) {
			const uniqueId = `uix-input-${Math.random().toString(36).substr(2, 9)}`;
			this.name = uniqueId;
		}
	}

	resetValue() {
		const el = this.q("input");
		if (el) el.value = null;
	}

	render() {
		const {
			name,
			autofocus,
			value,
			placeholder,
			label,
			disabled,
			required,
			regex,
			type,
			input,
			size,
			bind,
			checkbox,
			radio,
		} = this;

		const inputType = checkbox ? "checkbox" : radio ? "radio" : type;
		const inputValue = (bind ? bind.value : value) || "";

		// For checkbox and radio, the label usually goes after the input inline
		if (checkbox || radio) {
			return html`
        <uix-container width="full" horizontal items="center">
          <input
            type=${inputType}
            ?autofocus=${autofocus}
            ?disabled=${disabled}
            name=${name}
            id=${name}
            ?required=${required}
            regex=${regex}
            .checked=${!!inputValue}
            @input=${bind ? (e) => bind.setValue(e.target.checked) : input}
          />
          ${
						label
							? html`<label for=${name} ?required=${required}><uix-text size=${size}>${label}</uix-text></label>`
							: ""
					}
        </uix-container>
      `;
		}

		// For other input types, label above and input below as before
		return html`
        <input
          type=${inputType}
          value=${inputValue}
          ?autofocus=${autofocus}
          ?disabled=${disabled}
          size=${size}
          ?required=${required}
          name=${name}
          id=${name}
          regex=${regex}
          @input=${bind ? (e) => bind.setValue(e.target.value) : input}
          placeholder=${placeholder}
        />			
        ${
					label || placeholder
						? html`<label for=${name} ?required=${required}><uix-text size=${size}>${label || placeholder}</uix-text></label>`
						: ""
				}
    `;
	}
}

Input.register("uix-input", true);

})();
await (async () => {
const { APP } = self;
const { View, T, html, theme } = APP;

const RoundedOptions = {
	none: "0px",
	xs: "2px",
	sm: "4px",
	md: "8px",
	lg: "12px",
	xl: "16px",
	"2xl": "24px",
	full: "100%",
};

class Avatar extends View {
	static theme = {
		variant: (entry) => ({
			"--uix-avatar-background-color": `var(--color-${entry}-30)`,
			"--uix-avatar-text": `var(--color-${entry})`,
			"--uix-avatar-ring": `var(--color-${entry})`,
		}),
		size: (entry) => ({
			"min-width": `${theme.sizes[entry] / 5}px`,
			"min-height": `${theme.sizes[entry] / 5}px`,
		}),
		rounded: (entry) => ({
			"border-radius": entry,
		}),
	};

	static properties = {
		size: T.string({ defaultValue: "md", enum: Object.keys(theme.sizes) }),
		variant: T.string({
			defaultValue: "default",
			enum: Object.keys(theme.colors),
		}),
		src: T.string(),
		alt: T.string(),
		border: T.boolean({ defaultValue: true }),
		rounded: T.string({ defaultValue: "rounded-full", enum: RoundedOptions }),
		presence: T.string(),
		ring: T.boolean({ defaultValue: false }),
	};
	render() {
		return html`${!this.src ? null : html`<img src=${this.src}>`}`;
	}
}

Avatar.register("uix-avatar", true);

})();
await (async () => {
const { View, html, T, config } = window.APP;
const categories = [
	{ name: "Foodie", href: "/places/foodie", icon: "utensils" },
	{ name: "Sports", href: "/places/sports", icon: "dumbbell" },
	{ name: "Hikes", href: "/places/hikes", icon: "mountain" },
	{ name: "Parties", href: "/places/parties", icon: "music" },
	{ name: "Bars", href: "/places/bars", icon: "wine" },
	{ name: "Tours", href: "/places/tours", icon: "map" },
	{ name: "Dancing", href: "/places/dancing", icon: "drum" },
	{ name: "WhatsApp", href: "/places/whatsapp", icon: "message-circle" },
];
class AppIndex extends View {
	static properties = {
		mapCropHeight: T.number({ defaultValue: 250, sync: "ram" }),
	};

	firstUpdated() {
		this.mapCropHeight = 250;
	}

	render() {
		return html`      
        <uix-container full gap="lg">
          <uix-container padding="sm">
            <uix-input
              placeholder="Search for place or event"
              icon="search"
            ></uix-input>
          </uix-container>
          <uix-grid cols=4 justify="space-around" gap="md" padding="sm">
            ${categories.map(
							(category) => html`
                  <uix-button href=${category.href} icon=${category.icon} vertical size="xs" iconSize="lg" label=${category.name}></uix-button>
              `,
						)}
          </uix-grid>          
        </uix-container>
    `;
	}
}

AppIndex.register("rio-home");

})();
await (async () => {
const { APP } = self;
const { View, html, Permission, T } = APP;
const { PermissionTypes, PermissionStatus } = Permission;

class RioMap extends View {
	static properties = {
		imageUrl: T.string(),
		pins: T.array(),
		userLocation: T.object({ sync: "session", setter: true }),
		showUserLocation: T.boolean({ defaultValue: true }),
		mapCropWidth: T.number({ defaultValue: 430 }),
		mapCropHeight: T.number({ sync: "ram" }),
		imageWidth: T.number({ defaultValue: 450 }),
		imageHeight: T.number({ defaultValue: 640 }),
		cropX: T.number({ defaultValue: 0 }),
		cropY: T.number({ defaultValue: 0 }),
		isDragging: T.boolean({ defaultValue: false }),
		startX: T.number(),
		startY: T.number(),
		mapCenter: T.object(),
		zoomLevel: T.number({ defaultValue: 13 }),
	};

	connectedCallback() {
		super.connectedCallback();
		if (this.showUserLocation) {
			this.initializeLocationPermission();
		}
	}

	async initializeLocationPermission() {
		const res = await Permission.request(
			PermissionTypes.LOCATION,
			this.setUserLocation,
		);
	}

	startDragging(e) {
		this.isDragging = true;
		this.startX = e.touches ? e.touches[0].clientX : e.clientX;
		this.startY = e.touches ? e.touches[0].clientY : e.clientY;
	}

	stopDragging() {
		this.isDragging = false;
	}

	drag(e) {
		e.preventDefault();
		if (!this.isDragging) return;
		const x = e.touches ? e.touches[0].clientX : e.clientX;
		const y = e.touches ? e.touches[0].clientY : e.clientY;
		const dx = this.startX - x;
		const dy = this.startY - y;
		this.cropX = Math.max(
			0,
			Math.min(this.imageWidth - this.mapCropWidth, this.cropX + dx),
		);
		this.cropY = Math.max(
			0,
			Math.min(this.imageHeight - this.mapCropHeight, this.cropY + dy),
		);
		this.startX = x;
		this.startY = y;
	}
	calculatePinPosition(lat, lng) {
		const scale = 1 << this.zoomLevel;

		const worldCoordinate = this.project(lat, lng);
		const pixelCoordinate = this.worldToPixels(worldCoordinate, scale);

		const centerWorldCoordinate = this.project(
			this.mapCenter.lat,
			this.mapCenter.lng,
		);
		const centerPixelCoordinate = this.worldToPixels(
			centerWorldCoordinate,
			scale,
		);

		const x = pixelCoordinate.x - centerPixelCoordinate.x + this.imageWidth / 2;
		const y =
			pixelCoordinate.y - centerPixelCoordinate.y + this.imageHeight / 2;

		return { x, y };
	}

	project(lat, lng) {
		const siny = Math.sin((lat * Math.PI) / 180);
		return {
			x: (lng + 180) / 360,
			y: 0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI),
		};
	}

	worldToPixels(coord, scale) {
		const TILE_SIZE = 256;
		return {
			x: Math.floor(coord.x * scale * TILE_SIZE),
			y: Math.floor(coord.y * scale * TILE_SIZE),
		};
	}

	renderPin(pin) {
		const { lat, lng, title } = pin;
		const { x, y } = this.calculatePinPosition(lat, lng);
		const pinX = x - this.cropX;
		const pinY = y - this.cropY;

		if (
			pinX >= -10 &&
			pinX <= this.mapCropWidth + 10 &&
			pinY >= -10 &&
			pinY <= this.mapCropHeight + 10
		) {
			return html`
        <div pin 
          lat=${lat}
          lng=${lng}
          style="left: ${pinX}px; top: ${pinY}px; position: absolute;" 
          color="primary" 
          title="${title}">
          📍
        </div>
      `;
		}
		return null;
	}

	renderUserLocationPin() {
		if (!this.userLocation) return null;
		const { lat, lng } = this.userLocation;
		const { x, y } = this.calculatePinPosition(lat, lng);
		const pinX = x - this.cropX;
		const pinY = y - this.cropY;

		if (
			pinX >= -10 &&
			pinX <= this.mapCropWidth + 10 &&
			pinY >= -10 &&
			pinY <= this.mapCropHeight + 10
		) {
			return html`
        <div
          pin
          lat=${lat}
          lng=${lng}
          style="left: ${pinX}px; top: ${pinY}px; position: absolute; background: blue;"
          title="Your location"
        >
          📍
        </div>
      `;
		}
		return null;
	}

	render() {
		return html`
      <uix-container
        map
        style="
          width: ${this.mapCropWidth}px;
          height: ${this.mapCropHeight}px;
					transition: height 0.5s ease;
          overflow: hidden;
          position: relative;
        "
        @mousedown=${this.startDragging.bind(this)}
        @touchstart=${this.startDragging.bind(this)}
        @mouseup=${this.stopDragging.bind(this)}
        @touchend=${this.stopDragging.bind(this)}
        @mousemove=${this.drag.bind(this)}
        @touchmove=${this.drag.bind(this)} 
      >
        <div
          style="
            width: ${this.imageWidth}px;
            height: ${this.imageHeight}px;
            background-image: url(${this.imageUrl});
            background-size: cover;
            background-position: center;
            position: absolute;
            left: ${-this.cropX}px;
            top: ${-this.cropY}px;
          "
        ></div>
        ${this.pins?.map((pin) => this.renderPin(pin))}
        ${this.showUserLocation && this.userLocation ? this.renderUserLocationPin() : null}
      </uix-container>
    `;
	}
}

RioMap.register("rio-map", true);

})();
await (async () => {
const { APP } = self;
const { Icons, View, T, theme, helpers, html, config } = APP;
const { getSize } = helpers;

class Icon extends View {
	static theme = {
		size: (entry) => ({ "--uix-icon-size": getSize(entry, "0.05") }),
		fill: (entry) => ({ "--uix-icon-fill": entry }),
		stroke: (entry) => ({ "--uix-icon-stroke": entry }),
		"stroke-width": (entry) => ({ "--uix-icon-stroke-width": entry }),
		"background-color": (entry) => ({ "--uix-icon-background-color": entry }),
		color: (entry) => ({ "--uix-icon-color": entry }),
	};

	static properties = {
		name: T.string(),
		svg: T.string(),
		size: T.string({ enum: theme.sizes }),
		solid: T.boolean(),
		fill: T.string(),
		stroke: T.string(),
		"stroke-width": T.string(),
		"background-color": T.string(),
		color: T.string(),
	};

	async getIcon(name) {
		if (Icons[name]) {
			this.svg = Icons[name];
		} else {
			try {
				const response = await fetch(
					`${config.BASE_PATH}/extensions/icon-${theme.font.icon.family}/${theme.font.icon.family}/${name}.svg`,
				);
				if (response.ok) {
					const svgElement = await response.text();
					Icons[name] = svgElement;
					this.svg = svgElement;
				} else {
					console.error(`Failed to fetch icon: ${name}`);
				}
			} catch (error) {
				console.error(`Error fetching icon: ${name}`, error);
			}
		}
	}

	willUpdate() {
		if (this.name) {
			this.getIcon(this.name);
		}
	}

	render() {
		return !this.svg ? null : helpers.unsafeHTML(this.svg);
	}
}

Icon.register("uix-icon", true);

})();
await (async () => {
const { APP } = self;
const { View, T, theme, helpers } = APP;

const FontWeight = {
	thin: 100,
	light: 300,
	normal: 400,
	semibold: 600,
	bold: 700,
	black: 900,
};

const FontType = ["sans", "serif", "mono"];
const LeadingSizes = {
	tight: "1.25",
	normal: "1.5",
	loose: "2",
};
const TrackingSizes = {
	tighter: "-0.05em",
	tight: "-0.025em",
	normal: "0",
	wide: "0.025em",
	wider: "0.05em",
	widest: "0.1em",
};

const CursorTypes = [
	"auto",
	"default",
	"pointer",
	"wait",
	"text",
	"move",
	"not-allowed",
	"crosshair",
	"grab",
	"grabbing",
];

class Text extends View {
	static theme = {
		text: (entry) => ({ "--uix-text-align": entry }),
		"word-break": (entry) => ({ "word-break": entry }),
		variant: (entry) => ({ "--uix-text-color": `var(--color-${entry}-60)` }),
		weight: (entry) => ({ "--uix-text-font-weight": FontWeight[entry] }),
		font: (entry) => ({
			"--uix-text-font-family": `var(--uix-text-font-${entry})`,
		}),
		leading: (entry) => ({ "--uix-text-line-height": LeadingSizes[entry] }),
		tracking: (entry) => ({
			"--uix-text-letter-spacing": TrackingSizes[entry],
		}),
		transform: (entry) => ({ "--uix-text-text-transform": entry }),
		cursor: (entry) => ({ "--uix-text-cursor": entry }),
		size: (entry) => ({ "--uix-text-size": helpers.getTextSize(entry) }),
		heading: (entry) => ({
			"--uix-text-size": helpers.getTextSize(entry),
			"--uix-text-font-weight": FontWeight.bold,
		}),
		shadow: (entry) => ({ "--uix-text-shadow": entry }),
	};

	static properties = {
		text: T.string(),
		"word-break": T.string(),
		heading: T.string({ enum: theme.text.sizes }),
		size: T.string({ enum: theme.text.sizes }),
		variant: T.string({ enum: Object.keys(theme.colors) }),
		weight: T.string({ enum: FontWeight }),
		font: T.string({ enum: FontType, default: "sans" }),
		transform: T.string(),
		leading: T.string({ enum: LeadingSizes }),
		cursor: T.string({ enum: CursorTypes }),
		tracking: T.string({ enum: TrackingSizes }),
		indent: T.string({ enum: Object.keys(theme.sizes) }),
		reverse: T.boolean(),
		vertical: T.boolean(),
		inherit: T.boolean(),
		shadow: T.string(),
	};
}

Text.register("uix-text", true);

})();
await (async () => {
const { APP } = self;
const { View, T, html, theme, Router } = APP;
const sizeKeys = Object.keys(theme.sizes);

const GapSizes = {
	xs: "0.25",
	sm: "0.5",
	md: "1",
	lg: "1.5",
	xl: "2",
};
const getPadding = (entry) => {
	if (entry.includes("-")) {
		const [topBottom, leftRight] = entry.split("-");
		return {
			"--uix-link-padding": `calc(${theme.spacing[topBottom]} * 0.7) calc(${theme.spacing[leftRight]} * 0.7)`,
		};
	}
	return { "--uix-link-padding": `calc(${theme.spacing[entry]} * 0.7)` };
};

const Text = await View.get("uix-text");
class Link extends Text {
	static tag = "uix-link";

	static theme = {
		...Text.theme,
		variant: (entry) => ({
			"--uix-link-bg": `var(--color-${entry}-70)`,
			"--uix-link-text-color": `var(--color-${entry}-50)`,
			"--uix-link-hover-bg": `var(--color-${entry}-60)`,
			"--uix-link-hover-text-color": `var(--color-${entry}-50)`,
			"--uix-link-font-weight": "var(--font-weight-semibold, 600)",
		}),
		padding: getPadding,
		gap: (entry) => ({
			"icon-gap": `${entry}rem`,
		}),
		width: (entry) => ({ width: entry }),
	};

	static properties = {
		...Text.properties,
		content: T.object(),
		external: T.boolean(),
		skipRoute: T.boolean(),
		hideLabel: T.boolean(),
		tooltip: T.boolean(),
		accordion: T.boolean(),
		tab: T.boolean(),
		dropdown: T.boolean(),
		direction: T.string(),
		name: T.string(),
		alt: T.string(),
		label: T.string(),
		href: T.string(),
		related: T.string(),
		icon: T.string(),
		width: T.string({ enum: theme.sizes }),
		iconSize: T.string({ enum: sizeKeys }),
		size: T.string({ enum: sizeKeys }),
		padding: T.string(),
		leading: T.string({ enum: sizeKeys }),
		gap: T.string({ enum: GapSizes }),
		active: T.boolean(),
		reverse: T.boolean(),
		vertical: T.boolean(),
	};
	connectedCallback() {
		super.connectedCallback();
		if (this.dropdown) {
			this.on("click", (e) => {
				this.q("[dropdown]").toggleAttribute("selected");
			});

			document.addEventListener("click", this.handleOutsideClick);
			document.addEventListener("keydown", this.handleEscKey);
		}
	}
	defaultOnClick = (e) => {
		const link = e.currentTarget;
		const localLink =
			this.href && link.origin === window.location.origin && !this.external;
		const isComponent = this.dropdown || this.accordion || this.tab;
		if (!this.href || localLink || isComponent) {
			e.preventDefault();
		}
		const parent = this.closest("[multiple]");
		if (!parent) {
			const siblings = Array.from(
				this.parentElement.querySelectorAll(".uix-link"),
			);
			siblings.forEach((sibling) => {
				if (sibling !== this) sibling.removeAttribute("selected");
			});
		}

		this.toggleAttribute("selected");
		if (localLink) {
			if (isComponent)
				Router.push([link.pathname, link.search].filter(Boolean).join(""));
			else Router.go([link.pathname, link.search].filter(Boolean).join(""));
		}
	};

	disconnectedCallback() {
		super.disconnectedCallback();

		document.removeEventListener("click", this.handleOutsideClick);
		document.removeEventListener("keydown", this.handleEscKey);
	}

	handleOutsideClick = (e) => {
		if (this.dropdown && !this.contains(e.target)) {
			this.q("[dropdown]").removeAttribute("selected");
		}
	};

	handleEscKey = (e) => {
		if (this.dropdown && e.key === "Escape") {
			this.q("[dropdown]").removeAttribute("selected");
		}
	};

	render() {
		return html`<a
							class=${this.icon ? "uix-text-icon__element" : undefined}
							content
							href=${this.href}
							@click=${this.defaultOnClick.bind(this)}
							?reverse=${this.reverse}
							?vertical=${this.vertical}
							related=${this.related}
							name=${this.name || this.label}
							alt=${this.alt || this.label || this.name}
							padding=${this.padding}
							gap=${this.gap}
						>
							${
								this.icon
									? html`<uix-icon
										name=${this.icon}
										alt=${this.alt || this.label || this.name}
										size=${this.iconSize || this.size}
									></uix-icon>`
									: ""
							}
							${this.hideLabel ? null : this.label}
						</a>
					${
						!this.content && !this.tooltip
							? null
							: html`
					<uix-container ?dropdown=${this.dropdown} ?accordion=${this.accordion} ?tooltip=${this.tooltip}>
						${this.content || this.label}
					</uix-container>`
					}
        `;
	}
}

Link.register("uix-link", true);

})();
await (async () => {
const { APP } = self;
const { T, View, theme, helpers } = APP;
const Link = await View.get("uix-link");
class Button extends Link {
	static tag = "uix-button";
	static properties = {
		...Link.properties,
		width: T.string({ enums: theme.sizes }),
		text: T.string({ defaultValue: "center" }),
		rounded: T.string(),
		variant: T.string({
			defaultValue: "default",
			enum: Object.keys(theme.colors),
		}),
		size: T.string({ enum: theme.sizes, defaultValue: "md" }),
		padding: T.string({ enum: theme.spacing, defaultValue: "md" }),
	};

	static theme = {
		...Link.theme,
		types: {
			default: ({ variant }) => ({
				"border-size": "0",
				"background-color":
					variant === "default"
						? `var(--color-${variant}-100)`
						: `var(--color-${variant}-60)`,
				"hover-background-color": `var(--color-${variant}-30)`,
				"text-color": `var(--color-${variant}-1)`,
			}),
			bordered: ({ variant }) => ({
				"border-size": "1px",
				"background-color": "transparent",
				"hover-background-color": `var(--color-${variant}-30)`,
				"border-color": `var(--color-${variant}-40)`,
				"text-color": `var(--color-${variant}-100)`,
			}),
			ghost: ({ variant }) => ({
				"background-color": "transparent",
				"hover-background-color": `var(--color-${variant}-30)`,
				"border-size": "0px",
				"text-color": `var(--color-${variant}-100)`,
			}),
			outline: ({ variant }) => ({
				"background-color": "transparent",
				"hover-background-color": `var(--color-${variant}-30)`,
				"text-color": `var(--color-${variant}-90)`,
				"border-size": "1px",
			}),
		},
		rounded: (entry) => ({ "--uix-button-border-radius": entry }),
		width: (entry) => ({
			"--uix-button-width": `${!theme.sizes[entry] ? entry : typeof theme.sizes[entry] === "string" ? theme.sizes[entry] : `${theme.sizes[entry] / 2}px`}`,
		}),
	};
}

Button.register("uix-button", true);

})();
await (async () => {
const { APP } = self;
const { View, T, html } = APP;

const Button = await View.get("uix-button");
class DarkMode extends Button {
	static icons = ["moon", "sun"];
	static properties = {
		...Button.properties,
		ghost: T.boolean({ defaultValue: true }),
		width: T.string({ defaultValue: "fit" }),
		darkmode: T.boolean({ sync: "local", defaultValue: true }),
	};

	firstUpdated() {
		this.icon = this.darkmode ? "sun" : "moon";
		if (this.darkmode) document.documentElement.classList.add("dark");
	}

	toggleDarkMode() {
		if (!this.darkmode) {
			this.icon = "sun";
			document.documentElement.classList.add("dark");
		} else {
			this.icon = "moon";
			document.documentElement.classList.remove("dark");
		}
		this.darkmode = !this.darkmode;
	}

	connectedCallback() {
		super.connectedCallback();
		this.addEventListener("click", (event) => {
			this.toggleDarkMode();
		});
	}
}

DarkMode.register("theme-darkmode", true);

})();
await (async () => {
const { APP } = self;
const { View, html, T } = APP;
class AppDrawer extends View {
	static properties = {
		content: T.object(),
		currentRoute: T.object({ sync: "ram" }),
		position: T.string({ defaultValue: "right" }),
		buttonIcon: T.string({ defaultValue: "menu" }),
		drawerWidth: T.string({ defaultValue: "30vw" }),
		backgroundColor: T.string({ defaultValue: "color-primary-20" }),
		isOpen: T.boolean(),
	};

	toggleDrawer() {
		this.isOpen = !this.isOpen;
	}

	render() {
		const positionStyles = {
			left: "left: 0px; top: 50%; transform: translateY(-50%);",
			right: "right: 0px; top: 50%; transform: translateY(-50%);",
			"top-left": "left: 20px; top: 20px;",
			"top-right": "right: 20px; top: 20px;",
			"bottom-left": "left: 20px; bottom: 20px;",
			"bottom-right": "right: 20px; bottom: 20px;",
		};

		const buttonStyle = `position: fixed; 
		height: 50px;
		${positionStyles[this.position] || positionStyles.left} z-index: 101;`;

		const drawerStyle = `
      position: fixed;
      top: 0;
      ${this.position.includes("right") ? "right" : "left"}: 0;
      height: 100vh;
      width: ${this.drawerWidth};
      background-color: var(--${this.backgroundColor});
      transition: transform 0.3s ease-in-out;
      transform: translateX(${this.isOpen ? "0" : this.position.includes("right") ? "100%" : "-100%"});
      z-index: 100;
    `;
		return html`
      <uix-container position="fixed" items="center" z-index="1000">
        <uix-button
          icon=${this.isOpen ? "chevron-left" : this.buttonIcon}
          round
          primary
					height="sm"
          size="lg"
					width="fit"
          @click=${this.toggleDrawer.bind(this)}
          style=${buttonStyle}
        ></uix-button>
        <div style=${drawerStyle}>
					${this.content}
        </div>
			</uix-container>
    `;
	}
}

AppDrawer.register("uix-drawer");

})();
await (async () => {
const { View, html, T, routes, Router, config, Model, Controller } = window.APP;

const pins = [
	{ lat: -22.9068, lng: -43.1729, title: "Christ the Redeemer" },
	{ lat: -22.9136, lng: -43.1801, title: "arcos da Lapa " },
	{ lat: -22.975649, lng: -43.182016, title: "Copacabana Beach" },
];

class RioIndex extends View {
	static properties = {
		component: T.object(),
		currentRoute: T.object({ sync: "ram" }),
		bundleUrl: T.string(),
		pins: T.array(),
	};

	async connectedCallback() {
		super.connectedCallback();
		this.pins = await Model.places.getAll();
	}

	async bundleAppSPA() {
		await Controller.backend("BUNDLE_APP_SPA");
	}

	async bundleAppSSR() {
		await Controller.backend("BUNDLE_APP_SSR");
	}

	render() {
		const navIcons = [
			{ name: "home", icon: "house", href: "/" },
			{ name: "Calendar", icon: "calendar" },
			{ name: "add", icon: "circle-plus", href: "/meetup/new" },
			{ name: "favorites", icon: "heart", href: "/likes" },
			{ name: "profile", icon: "user" },
		];
		const { root, route = {} } = this.currentRoute || {};
		return html`
			${
				self.APP.config.ENV === "PRODUCTION"
					? null
					: html`<uix-drawer z-index="10000" .content=${html`
				<uix-list>				
				<uix-button @click=${this.bundleAppSPA.bind(this)}>Bundle SPA</uix-button>
				<uix-button @click=${this.bundleAppSSR.bind(this)}>Bundle SSR</uix-button>
				</uix-list>
			`}>				
			</uix-drawer>`
			}
      <uix-container justify="space-between">
        <uix-container horizontal padding="sm" justify="space-between" items="center" position="fixed" width="full" height="3xs" z-index="100">
					<uix-link
						icon=${root ? "menu" : "chevron-left"}
						label=${route.title}
						@click=${root ? undefined : () => Router.back()} 
						size="lg"
						weight="semibold"></uix-link>
          <uix-container horizontal items="center" gap="xs">
            <uix-icon @click=${() => Router.go("/notifications")} name="bell" size="lg"></uix-icon>
						<theme-darkmode></theme-darkmode>
          </uix-container>
        </uix-container>

        <uix-container horizontal height="3xs" width="100%"></uix-container>
				<uix-container full>
        <rio-stories></rio-stories>
        <rio-map
          imageUrl=${self.APP.Assets.get("map.png")}
          .mapCenter=${{ lat: -22.9449982, lng: -43.1963955 }}
          zoom="13"
          .pins=${!this.pins ? undefined : this.pins.items.map((pin) => ({ lng: pin.coordinates.longitude, lat: pin.coordinates.latitude, title: pin.name }))}
        ></rio-map>
					${this.component}
				</uix-container>        
        <uix-navbar docked="bottom" height="80px" width="full" style="z-index: 3000" horizontal children-flex="1">
          ${navIcons.map(
						(item) => html`
              <uix-button icon=${item.icon} href=${item.href} outline size="2xl"></uix-button>
            `,
					)}
        </uix-navbar>
				<uix-container height="80px"></uix-container>
      </uix-container>
    `;
	}
}
RioIndex.register("rio-template");

})();
await (async () => {
const { APP } = self;
const { T, View, theme, helpers } = APP;
const alignItems = {
	start: "flex-start",
	center: "center",
	end: "flex-end",
	baseline: "baseline",
	stretch: "stretch",
};

const overflowOptions = {
	"x-auto": "auto hidden",
	"y-auto": "hidden auto",
	"x-hidden": "hidden visible",
	"y-hidden": "visible hidden",
	"x-clip": "clip visible",
	"y-clip": "visible clip",
	"x-visible": "visible hidden",
	"y-visible": "hidden visible",
	"x-scroll": "scroll hidden",
	"y-scroll": "hidden scroll",
};

const shadowOptions = {
	none: "none",
	sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
	default: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
	md: "0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)",
	lg: "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.1)",
	xl: "0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)",
	"2xl": "0 25px 50px rgba(0, 0, 0, 0.25)",
};

const flex = ["1", "initial", "none", "auto"];

class Container extends View {
	static theme = {
		rows: (entry) => ({
			"--uix-container-flex-wrap": "wrap",
			"--uix-container-rows": entry,
		}),
		shadow: (entry) => ({ "--uix-container-box-shadow": shadowOptions[entry] }),
		items: (entry) => ({ "--uix-container-align-items": alignItems[entry] }),
		"max-resolution": (entry) => ({
			"--uix-container-max-resolution": helpers.getSize(entry),
			margin: "auto",
		}),
		overflow: (entry) => ({
			"--uix-container-overflow": overflowOptions[entry] ?? entry,
		}),
		position: (entry) => ({ "--uix-container-position": entry }),
		list: (entry) => ({ "--uix-container-list-style-type": entry }),
		justify: (entry) => ({
			"--uix-container-justify": entry,
		}),
		background: (entry) => ({
			background: entry,
		}),
		padding: (entry) => {
			if (entry.includes("-")) {
				const [topBottom, leftRight] = entry.split("-");
				return {
					"--uix-container-padding": `${theme.spacing[topBottom]} ${theme.spacing[leftRight]}`,
				};
			}
			return { "--uix-container-padding": theme.spacing[entry] };
		},
		margin: (entry) => {
			if (entry.includes("-")) {
				const [topBottom, leftRight] = entry.split("-");
				return {
					"--uix-container-margin": `${theme.spacing[topBottom]} ${theme.spacing[leftRight]}`,
				};
			}
			return { "--uix-container-margin": theme.spacing[entry] };
		},
		spacing: (entry) => ({
			"--uix-container-row-gap": theme.spacing[entry],
			"--uix-container-column-gap": theme.spacing[entry],
		}),
		gap: (entry) => ({ "--uix-container-gap": theme.spacing[entry] }),
		wrap: (entry) => ({ "--uix-container-flex-wrap": entry }),
		"background-color": (entry) => ({
			"--uix-container-background-color": `var(--color-${entry})`,
		}),
		"flex-basis": (entry) => ({ "flex-basis": entry }),
		flex: (entry) => ({ "--uix-container-flex": entry }),
		"z-index": (entry) => ({ "z-index": entry }),
		width: (entry) => ({
			"--uix-container-width": helpers.getSize(entry),
		}),
		height: (entry) => ({ "--uix-container-height": helpers.getSize(entry) }),
	};
	static properties = {
		background: T.string(),
		rows: T.string(),
		width: T.string({ enum: theme.sizes }),
		height: T.string({ enum: theme.sizes }),
		items: T.string({ enum: alignItems }),
		justify: T.string(),
		padding: T.string({ enum: Object.keys(theme.sizes) }),
		margin: T.string({ enum: Object.keys(theme.sizes) }),
		"z-index": T.number(),
		"flex-basis": T.string(),
		position: T.string(),
		list: T.string({ enum: ["disc", "decimal", "none"] }),
		overflow: T.string({ enum: overflowOptions }),
		"background-color": T.string(),
		"max-resolution": T.string({ enum: Object.keys(theme.sizes) }),
		shadow: T.string({ enum: shadowOptions }),
		spacing: T.string({ enum: Object.keys(theme.sizes) }),
		gap: T.string({ enum: Object.keys(theme.sizes) }),
		wrap: T.string({ enum: ["nowrap", "wrap", "wrap-reverse"] }),
		secondary: T.boolean(),
		horizontal: T.boolean(),
		relative: T.boolean(),
		responsive: T.boolean(),
		reverse: T.boolean(),
		shrink: T.boolean(),
		grow: T.boolean(),
		rounded: T.boolean(),
		grid: T.boolean(),
		flex: T.string(),
	};
}
Container.register("uix-container", true);

})();
await (async () => {
const { APP } = self;
const { View, T, theme, helpers } = APP;

const Container = await View.get("uix-container");

class Card extends Container {
	static properties = {
		...Container.properties,
		variant: T.string({
			defaultValue: "default",
			enum: Object.keys(theme.colors),
		}),
		size: {
			...Container.properties.size,
			defaultValue: "md",
		},
		gap: {
			...Container.properties.gap,
			defaultValue: "md",
		},
		shadow: {
			...Container.properties.shadow,
			defaultValue: "md",
		},
		padding: {
			...Container.properties.padding,
			defaultValue: "md",
		},
		justify: {
			...Container.properties.justify,
			defaultValue: "space-between",
		},
	};
	static theme = {
		...Container.theme,
		variant: (entry) => ({
			"--background-color": `var(--color-${entry}-1)`,
			"--text-color": `var(--color-${entry}-90)`,
			"--uix-card-border-color": `var(--color-${entry})`,
		}),
		size: (entry) => ({
			"--uix-card-width": helpers.getSize(entry),
			"--uix-card-min-height": helpers.getSize(entry, "0.5"),
		}),
	};
}

Card.register("uix-card", true);

})();
await (async () => {
const { APP } = self;
const { View, T, theme } = APP;
const Container = await View.get("uix-container");

class Grid extends Container {
	static theme = {
		...Container.theme,
		rows: (entry) => ({ "--uix-grid-rows": entry }),
		cols: (entry) => ({ "--uix-grid-cols": entry }),
		"grid-gap": (entry) => ({ "--uix-grid-gap": theme.spacing[entry] }),
		"template-areas": (entry) => ({ "--uix-grid-template-areas": entry }),
	};

	static properties = {
		...Container.properties,
		rows: T.number(),
		cols: T.number(),
		"grid-gap": T.string({ enum: Object.keys(theme.spacing) }),
		"template-areas": T.string(),
	};
}
Grid.register("uix-grid", true);

})();
await (async () => {
const { APP } = self;
const { View } = APP;
const Container = await View.get("uix-container");

class List extends Container {}

List.register("uix-list", true);

})();
await (async () => {
const { APP } = self;
const { View, T } = APP;
const List = await View.get("uix-list");

class Navbar extends List {
	static properties = {
		...List.properties,
		join: T.boolean({ defaultValue: true }),
		docked: T.string(),
	};
}

Navbar.register("uix-navbar", true);

})();
await (async () => {
const { APP } = self;
const { View, html, T } = APP;

const stories = [
	{
		title: "Live Samba Show",
		type: "color",
		backgroundColor: "#0000FF",
		avatar: "https://i.pravatar.cc/300?img=1",
		text: "Join the live samba show tonight at Lapa!",
		expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
		read: false,
		username: "Alice",
	},
	{
		title: "Street Art Festival",
		type: "color",
		backgroundColor: "#0000FF",
		avatar: "https://i.pravatar.cc/300?img=2",
		text: "Amazing street art festival in Santa Teresa.",
		expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
		read: false,
		username: "Bob",
	},
	{
		title: "Sunset at Sugarloaf",
		type: "color",
		backgroundColor: "#0000FF",
		avatar: "https://i.pravatar.cc/300?img=3",
		text: "Catch the beautiful sunset at Sugarloaf Mountain.",
		expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
		read: false,
		username: "Carol",
	},
	{
		title: "Rio YouTube Short",
		type: "youtube",
		videoId: "u7LTr5nspME",
		avatar: "https://i.pravatar.cc/300?img=4",
		expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
		read: false,
		username: "Dave",
	},
	{
		title: "Rio YouTube Short",
		type: "youtube",
		videoId: "_7AuJ4intGI",
		avatar: "https://i.pravatar.cc/300?img=5",
		expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
		read: false,
		username: "Eva",
	},
	{
		title: "Sunset at Sugarloaf",
		type: "color",
		backgroundColor: "#0000FF",
		avatar: "https://i.pravatar.cc/300?img=6",
		text: "Catch the beautiful sunset at Sugarloaf Mountain.",
		expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
		read: false,
		username: "Frank",
	},
	{
		title: "Sunset at Sugarloaf",
		type: "color",
		backgroundColor: "#0000FF",
		avatar: "https://i.pravatar.cc/300?img=7",
		text: "Catch the beautiful sunset at Sugarloaf Mountain.",
		expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
		read: false,
		username: "Grace",
	},
];

const Container = await View.get("uix-container");

class RioStories extends Container {
	static properties = {
		...Container.properties,
		currentStoryIndex: T.number(),
		isViewingStory: T.boolean(),
		loaderProgress: T.number(),
	};

	constructor() {
		super();
		this.currentStoryIndex = 0;
		this.isViewingStory = false;
		this.loaderProgress = 0;
		this.boundKeyHandler = this.handleKeyPress.bind(this);
		this.boundBackHandler = this.handleBackButton.bind(this);
		this.storyDuration = 5000;
		this.animationFrameId = null;
		this.lastTimestamp = null;
	}

	connectedCallback() {
		super.connectedCallback();
		document.addEventListener("keydown", this.boundKeyHandler);
		window.addEventListener("popstate", this.boundBackHandler);
		window.addEventListener("message", this.handleYouTubeMessage.bind(this));
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		document.removeEventListener("keydown", this.boundKeyHandler);
		window.removeEventListener("popstate", this.boundBackHandler);
		window.removeEventListener("message", this.handleYouTubeMessage.bind(this));
		this.stopLoaderAnimation();
	}

	handleYouTubeMessage(event) {
		if (event.origin !== "https://www.youtube.com") return;
		try {
			const data = JSON.parse(event.data);
			if (data.event === "onStateChange" && data.info === 0) {
				this.goToNextStory();
			}
		} catch (error) {
			console.error("Error parsing YouTube message:", error);
		}
	}

	handleKeyPress(event) {
		if (event.key === "Escape" && this.isViewingStory) {
			this.exitFullScreen();
		}
	}

	handleBackButton(event) {
		if (this.isViewingStory) {
			event.preventDefault();
			this.exitFullScreen();
		}
	}

	startViewingStories() {
		this.isViewingStory = true;
		history.pushState(null, "");
		this.viewCurrentStory();
	}

	viewCurrentStory() {
		if (this.currentStoryIndex < stories.length) {
			const story = stories[this.currentStoryIndex];
			story.read = true;
			if (story.type === "youtube") {
				this.stopLoaderAnimation();
			} else {
				this.loaderProgress = 0;
				this.lastTimestamp = null;
				this.startLoaderAnimation();
			}
			this.requestUpdate();
		} else {
			this.exitFullScreen();
		}
	}

	startLoaderAnimation() {
		this.stopLoaderAnimation();
		this.animationFrameId = requestAnimationFrame(this.updateLoader.bind(this));
	}

	stopLoaderAnimation() {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	updateLoader(timestamp) {
		if (!this.lastTimestamp) this.lastTimestamp = timestamp;
		const elapsed = timestamp - this.lastTimestamp;
		this.loaderProgress += (elapsed / this.storyDuration) * 100;
		if (this.loaderProgress >= 100) {
			this.goToNextStory();
		} else {
			this.requestUpdate();
			this.animationFrameId = requestAnimationFrame(
				this.updateLoader.bind(this),
			);
		}
		this.lastTimestamp = timestamp;
	}

	goToNextStory() {
		this.stopLoaderAnimation();
		this.currentStoryIndex++;
		if (this.currentStoryIndex < stories.length) {
			this.viewCurrentStory();
		} else {
			this.exitFullScreen();
		}
	}

	exitFullScreen() {
		this.isViewingStory = false;
		this.currentStoryIndex = 0;
		this.stopLoaderAnimation();
		history.back();
		this.requestUpdate();
	}

	renderStoryCircle(story, index) {
		return html`
      <uix-container
        @click=${() => {
					this.currentStoryIndex = index;
					this.startViewingStories();
				}}
				gap="sm"
      >
        <uix-avatar
          size="sm"
          ring
					src=${story.avatar}
          variant=${story.read ? "secondary" : "primary"}
        ></uix-avatar>
        <uix-text text="center" heading="xs">
          ${story.username}
				</uix-text>
      </uix-container>
    `;
	}

	renderFullScreenStory(story) {
		if (story.type === "youtube") {
			return html`
        <style>
          .youtube-container {
            position: fixed;
            z-index: 10000;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: black;
          }
          .youtube-iframe {
            width: 100%;
            height: 100%;
            border: none;
          }
          .close-button {
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: 30px;
            color: white;
            cursor: pointer;
            z-index: 1000001;
          }
        </style>
        <div class="youtube-container">
          <iframe
            class="youtube-iframe"
            src="https://www.youtube.com/embed/${story.videoId}?autoplay=1&controls=0&rel=0&showinfo=0&modestbranding=1&playsinline=1&enablejsapi=1"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
          <div class="close-button" @click=${this.exitFullScreen.bind(this)}>×</div>
        </div>
      `;
		}

		return html`
      <style>
        .loader-bar {
          position: absolute;
          top: 0;
          left: 0;
          height: 4px;
          background-color: white;
          transition: width 0.1s linear;
        }
        .close-button {
          position: absolute;
          top: 20px;
          right: 20px;
          font-size: 30px;
          color: white;
          cursor: pointer;
          z-index: 1000001;
        }
        .story {
          position: fixed;
          z-index: 1000000;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: ${story.backgroundColor};
          display: flex;
          justify-content: center;
          align-items: center;
          color: white;
          font-size: 72px;
          text-align: center;
          padding: 20px;
          cursor: pointer;
        }
      </style>
      <div @click=${this.goToNextStory.bind(this)} class="story">
        <div class="loader-bar" style=${`width: ${[this.loaderProgress, "%"].join("")}`}></div>
        <div
          class="close-button"
          @click=${(e) => {
						e.stopPropagation();
						this.exitFullScreen();
					}}
        >
          ×
        </div>
        ${story.text}
      </div>
    `;
	}

	render() {
		return html`
      <uix-list width="fit-content" horizontal padding="sm" gap="md">
        ${stories.map((story, index) => this.renderStoryCircle(story, index))}
      </uix-list>
      ${
				this.isViewingStory
					? this.renderFullScreenStory(stories[this.currentStoryIndex])
					: ""
			}
    `;
	}
}

RioStories.register("rio-stories");

})();
await (async () => {
const { APP } = self;
const { T, View, html, helpers } = APP;
const { staticHTML } = helpers;

const Container = await View.get("uix-container");

class RouterComponent extends Container {
	static properties = {
		...Container.properties,
		currentRoute: T.object({ sync: "ram" }),
	};

	renderRoute(route, params) {
		const component =
			typeof route.component === "function"
				? route.component(params)
				: route.component;
		return route.template
			? staticHTML`<${helpers.unsafeStatic(route.template)} .component=${component}>
			</${helpers.unsafeStatic(route.template)}>`
			: component;
	}

	render() {
		const { route, params } = this.currentRoute || {};

		return route
			? this.renderRoute(route, params)
			: html`<uix-container>404: Page not found</uix-container>`;
	}
}

RouterComponent.register("router-ui");

})();
await (async () => {
const { View, html, routes } = self.APP;

class AppIndex extends View {
	render() {
		return html`<router-ui full .routes=${routes}></router-ui>`;
	}
}

AppIndex.register("app-index");

})();

	}
)();
