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
const csv_writer_1 = require("csv-writer");
function mergeResults() {
    return __awaiter(this, void 0, void 0, function* () {
        const filePath = 'output/bizi-profile-recovered.csv';
        const records = new Map();
        if (!(yield fs_extra_1.default.pathExists(filePath)))
            return;
        yield new Promise((resolve) => {
            fs_extra_1.default.createReadStream(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                // Use sourceUrl as the unique key. Later records overwrite earlier ones.
                if (data.sourceUrl) {
                    records.set(data.sourceUrl, data);
                }
            })
                .on('end', resolve);
        });
        const mergedRecords = Array.from(records.values());
        const header = Object.keys(mergedRecords[0]).map(k => ({ id: k, title: k }));
        const writer = (0, csv_writer_1.createObjectCsvWriter)({
            path: 'output/bizi-profile-merged.csv',
            header
        });
        yield writer.writeRecords(mergedRecords);
        console.log(`Merged ${mergedRecords.length} unique records into bizi-profile-merged.csv`);
    });
}
mergeResults().catch(console.error);
