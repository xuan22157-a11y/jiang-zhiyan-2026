import fs from "node:fs";

const source = "public/assets/ceramic/models/ceramic-vase.glb";
const destination = "public/assets/ceramic/models/ceramic-vase-runtime.glb";
const buffer = fs.readFileSync(source);
const jsonLength = buffer.readUInt32LE(12);
const json = JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength));
delete json.extensionsUsed;
delete json.extensionsRequired;
delete json.images;
delete json.textures;
delete json.samplers;
for (const material of json.materials ?? []) {
  if (material.pbrMetallicRoughness) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.pbrMetallicRoughness.metallicRoughnessTexture;
  }
  delete material.normalTexture;
  delete material.occlusionTexture;
  delete material.emissiveTexture;
}
const binaryOffset = 20 + jsonLength;
const binaryLength = buffer.readUInt32LE(binaryOffset);
const binaryType = buffer.readUInt32LE(binaryOffset + 4);
const binary = buffer.subarray(binaryOffset + 8, binaryOffset + 8 + binaryLength);
const jsonBytes = Buffer.from(JSON.stringify(json));
const paddedJsonLength = Math.ceil(jsonBytes.length / 4) * 4;
const output = Buffer.alloc(12 + 8 + paddedJsonLength + 8 + binary.length);
output.writeUInt32LE(0x46546c67, 0);
output.writeUInt32LE(2, 4);
output.writeUInt32LE(output.length, 8);
output.writeUInt32LE(paddedJsonLength, 12);
output.writeUInt32LE(0x4e4f534a, 16);
jsonBytes.copy(output, 20);
output.fill(0x20, 20 + jsonBytes.length, 20 + paddedJsonLength);
const outputBinaryOffset = 20 + paddedJsonLength;
output.writeUInt32LE(binary.length, outputBinaryOffset);
output.writeUInt32LE(binaryType, outputBinaryOffset + 4);
binary.copy(output, outputBinaryOffset + 8);
fs.writeFileSync(destination, output);
console.log(destination);
