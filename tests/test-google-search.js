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
function verifyGoogleSearch() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
        const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX;
        console.log('🚀 Google Custom Search API Verification');
        console.log('----------------------------------------');
        if (!apiKey) {
            console.error('❌ Missing GOOGLE_CLOUD_API_KEY in .env');
            return;
        }
        if (!cx) {
            console.warn('⚠️  Missing GOOGLE_CUSTOM_SEARCH_CX in .env');
            console.log('Note: The project currently defaults CX to your API Key in config.ts, which is likely incorrect.');
        }
        console.log(`🔹 API Key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);
        console.log(`🔹 CX ID:   ${cx ? cx : 'NOT SET (using API Key as fallback)'}`);
        const customsearch = googleapis_1.google.customsearch('v1');
        try {
            console.log('\n🔍 Attempting test search for "Google"...');
            const res = yield customsearch.cse.list({
                cx: cx || apiKey, // Fallback to current behavior to show it fails
                q: 'Google',
                auth: apiKey,
            });
            console.log('✅ API SUCCESS!');
            console.log(`📊 Results found: ${(_a = res.data.searchInformation) === null || _a === void 0 ? void 0 : _a.totalResults}`);
            if (res.data.items && res.data.items.length > 0) {
                console.log('🔝 Top result:', res.data.items[0].title);
                console.log('🔗 Link:', res.data.items[0].link);
            }
            // Check if it can search the entire web
            console.log('\n🔍 Testing "Search the entire web" capability...');
            const webRes = yield customsearch.cse.list({
                cx: cx || apiKey,
                q: 'site:wikipedia.org Google',
                auth: apiKey,
            });
            if (webRes.data.items && webRes.data.items.length > 0) {
                console.log('✅ Entire web search appears functional for this CX.');
            }
            else {
                console.log('⚠️  No results for specific site search. CX might be restricted to specific domains.');
            }
        }
        catch (error) {
            console.error('\n❌ API FAILURE');
            console.error(`Status: ${error.code || 'Unknown'}`);
            console.error(`Message: ${error.message}`);
            if ((_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.error) {
                const gError = error.response.data.error;
                console.log('\nDetailed Error Information:');
                console.log(JSON.stringify(gError, null, 2));
                if (gError.message.includes('IP address restriction')) {
                    console.log('\n💡 RECOMMENDATION: Your API Key has IP restrictions. Go to Google Cloud Console and either add this IP or remove the restriction.');
                }
                else if (gError.status === 'INVALID_ARGUMENT' && gError.message.includes('cx')) {
                    console.log('\n💡 RECOMMENDATION: The Search Engine ID (CX) is invalid. You must create one at https://programmableweb.com and ensure it is set to "Search the entire web" (if available).');
                }
            }
        }
    });
}
verifyGoogleSearch().catch(console.error);
