"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = __importDefault(require("fs-extra"));
const csv_parser_1 = __importDefault(require("csv-parser"));
function checkCoverage() {
    return __awaiter(this, void 0, void 0, function* () {
        const inputPath = 'input/slovenian_ecommerces.csv';
        const outputPath = 'output/bizi-profile-scrape-2026-04-28-14-00-34.csv';
        const inputRows = [];
        const outputRows = [];
        yield new Promise((resolve) => {
            fs_extra_1.default.createReadStream(inputPath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => inputRows.push(data))
                .on('end', resolve);
        });
        if (yield fs_extra_1.default.pathExists(outputPath)) {
            yield new Promise((resolve) => {
                fs_extra_1.default.createReadStream(outputPath)
                    .pipe((0, csv_parser_1.default)())
                    .on('data', (data) => outputRows.push(data))
                    .on('end', resolve);
            });
        }
        console.log(`Input rows: ${inputRows.length}`);
        console.log(`Output rows: ${outputRows.length}`);
        const outputUrls = new Set(outputRows.map(r => r.sourceUrl || r.URL));
        const missing = inputRows.filter(r => !outputUrls.has(r.URL));
        console.log(`Missing from scrape: ${missing.length}`);
        if (missing.length > 0) {
            console.log('First 5 missing:');
            console.log(missing.slice(0, 5).map(m => m.URL));
        }
    });
}
checkCoverage().catch(console.error);
