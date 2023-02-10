const basePath = process.cwd();
const { MODE } = require(`${basePath}/constants/blend_mode.js`);
const { NETWORK } = require(`${basePath}/constants/network.js`);

const network = NETWORK.eth;

// General metadata for Ethereum
const namePrefix = "Lazynaire";
const description = "Remember to replace this description";
const baseUri = "ipfs://NewUriToReplace";

// const solanaMetadata = {
//   symbol: "YC",
//   seller_fee_basis_points: 1000, // Define how much % you want from secondary market sales 1000 = 10%
//   external_url: "https://www.youtube.com/c/hashlipsnft",
//   creators: [
//     {
//       address: "7fXNuer5sbZtaTEPhtJ5g5gNtuyRoKkvxdjEjEnPN4mC",
//       share: 100,
//     },
//   ],
// };

// If you have selected Solana then the collection starts from 0 automatically
const layerConfigurations = [
  {
    //Low tier
    growEditionSizeTo: 10,
    layersOrder: [
      { name: "Background" },
      { name: "Type" },
      { name: "Eyes" },
      { name: "Mouth" },
      { name: "Hair" },
      { name: "OOTD" },
      { name: "Face" },
      { name: "Headwear" },
      { name: "Earwear" },
      { name: "Neckwear" },
      { name: "Hand" },
    ],
  },
];

const pairTraitConfig = [{
  parentLayer: "Type",
  childLayer: "Hand",
  pairConfig: [
    {
      parentTrait: "Biege Y",
      childTrait: [
        "Shhh Y",
        "Nothing"
      ]
    },
    {
      parentTrait: "Earth Z",
      childTrait: [
        "Shhh Z",
        "Nothing"
      ]
    },
    {
      parentTrait: "Sandy X",
      childTrait : [
        "Shhh X",
        "Nothing"
      ]
    }
  ]
},
]

const shuffleLayerConfigurations = false;

const debugLogs = false;

const format = {
  //width: 512,
  //height: 512,
  width: 100,
  height: 100,
  smoothing: false,
};

const gif = {
  export: false,
  repeat: 0,
  quality: 100,
  delay: 500,
};

const text = {
  only: false,
  color: "#ffffff",
  size: 20,
  xGap: 40,
  yGap: 40,
  align: "left",
  baseline: "top",
  weight: "regular",
  family: "Courier",
  spacer: " => ",
};

const pixelFormat = {
  ratio: 2 / 128,
};

const background = {
  generate: true,
  brightness: "100%",
  static: false,
  default: "#000000",
};

const extraMetadata = {};

const rarityDelimiter = "#";

const uniqueDnaTorrance = 200;

const preview = {
  thumbPerRow: 5,
  thumbWidth: 50,
  imageRatio: format.height / format.width,
  imageName: "preview.png",
};

const preview_gif = {
  numberOfImages: 5,
  order: "ASC", // ASC, DESC, MIXED
  repeat: 0,
  quality: 100,
  delay: 500,
  imageName: "preview.gif",
};

module.exports = {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  preview,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  pixelFormat,
  text,
  namePrefix,
  network,
  //solanaMetadata,
  gif,
  preview_gif,
  pairTraitConfig
};
