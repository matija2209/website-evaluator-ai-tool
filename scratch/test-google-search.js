"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const googleapis_1 = require("googleapis");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
function testSearch() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
        // If config.ts uses the same key for CX, let's see if that works (unlikely but possible if misconfigured)
        const cx = process.env.GOOGLE_CLOUD_API_KEY;
        console.log('Testing Google Custom Search API...');
        console.log(`API Key: ${apiKey === null || apiKey === void 0 ? void 0 : apiKey.substring(0, 5)}...`);
        console.log(`CX: ${cx === null || cx === void 0 ? void 0 : cx.substring(0, 5)}...`);
        const customsearch = googleapis_1.google.customsearch('v1');
        try {
            const res = yield customsearch.cse.list({
                cx: cx,
                q: 'Google',
                auth: apiKey,
            });
            console.log('✅ Search successful!');
            console.log(`Results found: ${(_a = res.data.searchInformation) === null || _a === void 0 ? void 0 : _a.totalResults}`);
            if (res.data.items && res.data.items.length > 0) {
                console.log('First result:', res.data.items[0].title, '-', res.data.items[0].link);
            }
        }
        catch (error) {
            console.error('❌ Search failed!');
            console.error('Error message:', error.message);
            if (error.response && error.response.data) {
                console.error('Response data:', JSON.stringify(error.response.data, null, 2));
            }
            console.log('\n--- Recommendation ---');
            if (error.message.includes('400') || error.message.includes('invalid')) {
                console.log('It seems the Search Engine ID (CX) is invalid. You likely need a separate CX ID from programmableweb.com');
            }
        }
    });
}
testSearch().catch(console.error);
