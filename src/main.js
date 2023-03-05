const basePath = process.cwd();
const { NETWORK } = require(`${basePath}/constants/network.js`);
const fs = require("fs");
const sha1 = require(`${basePath}/node_modules/sha1`);
const { createCanvas, loadImage } = require(`${basePath}/node_modules/canvas`);
const buildDir = `${basePath}/build`;
const layersDir = `${basePath}/layers`;
const {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  shuffleLayerConfigurations,
  debugLogs,
  extraMetadata,
  text,
  namePrefix,
  network,
  solanaMetadata,
  gif,
  pairTraitConfig,
} = require(`${basePath}/src/config.js`);
const canvas = createCanvas(format.width, format.height);
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = format.smoothing;
var metadataList = [];
var attributesList = [];
var dnaList = new Set();
const DNA_DELIMITER = "-";
const HashlipsGiffer = require(`${basePath}/modules/HashlipsGiffer.js`);
var seedrandom = require('seedrandom');
var rng = seedrandom('1');
var traitPair = new Map();

let hashlipsGiffer = null;

const buildSetup = () => {
  if (fs.existsSync(buildDir)) {
    fs.rmdirSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir);
  fs.mkdirSync(`${buildDir}/json`);
  fs.mkdirSync(`${buildDir}/images`);
  if (gif.export) {
    fs.mkdirSync(`${buildDir}/gifs`);
  }
};

const getRarityWeight = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = Number(
    nameWithoutExtension.split(rarityDelimiter).pop()
  );
  if (isNaN(nameWithoutWeight)) {
    nameWithoutWeight = 1;
  }
  return nameWithoutWeight;
};

const cleanDna = (_str) => {
  const withoutOptions = removeQueryStrings(_str);
  var dna = Number(withoutOptions.split(":").shift());
  return dna;
};

const cleanName = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift();
  return nameWithoutWeight;
};

const getElements = (path) => {
  return fs
    .readdirSync(path)
    .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
    .map((i, index) => {
      if (i.includes("-")) {
        throw new Error(`layer name can not contain dashes, please fix: ${i}`);
      }
      return {
        id: index,
        name: cleanName(i),
        filename: i,
        path: `${path}${i}`,
        weight: getRarityWeight(i),
      };
    });
};

const layersSetup = (layersOrder) => {
  const layers = layersOrder.map((layerObj, index) => ({
    id: index,
    elements: getElements(`${layersDir}/${layerObj.name}/`),
    name:
      layerObj.options?.["displayName"] != undefined
        ? layerObj.options?.["displayName"]
        : layerObj.name,
    blend:
      layerObj.options?.["blend"] != undefined
        ? layerObj.options?.["blend"]
        : "source-over",
    opacity:
      layerObj.options?.["opacity"] != undefined
        ? layerObj.options?.["opacity"]
        : 1,
    bypassDNA:
      layerObj.options?.["bypassDNA"] !== undefined
        ? layerObj.options?.["bypassDNA"]
        : false,
  }));
  return layers;
};

const saveImage = (_editionCount) => {
  fs.writeFileSync(
    `${buildDir}/images/${_editionCount}.png`,
    canvas.toBuffer("image/png")
  );
};

const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  let pastel = `hsl(${hue}, 100%, ${background.brightness})`;
  return pastel;
};

const drawBackground = () => {
  ctx.fillStyle = background.static ? background.default : genColor();
  ctx.fillRect(0, 0, format.width, format.height);
};

const addMetadata = (_dna, _edition) => {
  let dateTime = Date.now();
  let tempMetadata = {
    name: `${namePrefix} #${_edition}`,
    description: description,
    image: `${baseUri}/${_edition}.png`,
    dna: sha1(_dna),
    edition: _edition,
    date: dateTime,
    ...extraMetadata,
    attributes: attributesList,
    compiler: "HashLips Art Engine",
  };
  if (network == NETWORK.sol) {
    tempMetadata = {
      //Added metadata for solana
      name: tempMetadata.name,
      symbol: solanaMetadata.symbol,
      description: tempMetadata.description,
      //Added metadata for solana
      seller_fee_basis_points: solanaMetadata.seller_fee_basis_points,
      image: `${_edition}.png`,
      //Added metadata for solana
      external_url: solanaMetadata.external_url,
      edition: _edition,
      ...extraMetadata,
      attributes: tempMetadata.attributes,
      properties: {
        files: [
          {
            uri: `${_edition}.png`,
            type: "image/png",
          },
        ],
        category: "image",
        creators: solanaMetadata.creators,
      },
    };
  }
  metadataList.push(tempMetadata);
  attributesList = [];
};

const addAttributes = (_element) => {
  let selectedElement = _element.layer.selectedElement;
  attributesList.push({
    trait_type: _element.layer.name,
    value: selectedElement.name,
  });
};

const loadLayerImg = async (_layer) => {
  try {
    return new Promise(async (resolve) => {
      const image = await loadImage(`${_layer.selectedElement.path}`);
      resolve({ layer: _layer, loadedImage: image });
    });
  } catch (error) {
    console.error("Error loading image:", error);
  }
};

const addText = (_sig, x, y, size) => {
  ctx.fillStyle = text.color;
  ctx.font = `${text.weight} ${size}pt ${text.family}`;
  ctx.textBaseline = text.baseline;
  ctx.textAlign = text.align;
  ctx.fillText(_sig, x, y);
};

const drawElement = (_renderObject, _index, _layersLen) => {
  ctx.globalAlpha = _renderObject.layer.opacity;
  ctx.globalCompositeOperation = _renderObject.layer.blend;
  text.only
    ? addText(
      `${_renderObject.layer.name}${text.spacer}${_renderObject.layer.selectedElement.name}`,
      text.xGap,
      text.yGap * (_index + 1),
      text.size
    )
    : ctx.drawImage(
      _renderObject.loadedImage,
      0,
      0,
      format.width,
      format.height
    );

  addAttributes(_renderObject);
};

const constructLayerToDna = (_dna = "", _layers = []) => {
  let mappedDnaToLayers = _layers.map((layer, index) => {
    let selectedElement = layer.elements.find(
      (e) => e.id == cleanDna(_dna.split(DNA_DELIMITER)[index])
    );
    return {
      name: layer.name,
      blend: layer.blend,
      opacity: layer.opacity,
      selectedElement: selectedElement,
    };
  });
  return mappedDnaToLayers;
};

/**
 * In some cases a DNA string may contain optional query parameters for options
 * such as bypassing the DNA isUnique check, this function filters out those
 * items without modifying the stored DNA.
 *
 * @param {String} _dna New DNA string
 * @returns new DNA string with any items that should be filtered, removed.
 */
const filterDNAOptions = (_dna) => {
  const dnaItems = _dna.split(DNA_DELIMITER);
  const filteredDNA = dnaItems.filter((element) => {
    const query = /(\?.*$)/;
    const querystring = query.exec(element);
    if (!querystring) {
      return true;
    }
    const options = querystring[1].split("&").reduce((r, setting) => {
      const keyPairs = setting.split("=");
      return { ...r, [keyPairs[0]]: keyPairs[1] };
    }, []);

    return options.bypassDNA;
  });

  return filteredDNA.join(DNA_DELIMITER);
};

/**
 * Cleaning function for DNA strings. When DNA strings include an option, it
 * is added to the filename with a ?setting=value query string. It needs to be
 * removed to properly access the file name before Drawing.
 *
 * @param {String} _dna The entire newDNA string
 * @returns Cleaned DNA string without querystring parameters.
 */
const removeQueryStrings = (_dna) => {
  const query = /(\?.*$)/;
  return _dna.replace(query, "");
};

const isDnaUnique = (_DnaList = new Set(), _dna = "") => {
  const _filteredDNA = filterDNAOptions(_dna);
  return !_DnaList.has(_filteredDNA);
};

const createDna = (_layers) => {
  let randNum = [];
  //let parentChildLayerMapping = new Map();
  let parentChildTraitMapping = new Map();
  let hasChildLayerBool = false;
  let childTraits = [];
  let pairLayer = [];
  let backupPairLayer = [];
  _layers.forEach((layer) => {
    var totalWeight = 0;

    // Check if the current layer has a child layer
    //console.log("layer.name: ",layer.name);
    if (hasChildLayer(layer.name)) {
      //parentChildLayerMapping.set(layer.name, getChildLayer(layer.name));
      hasChildLayerBool = true;
      //console.log("parentChildLayerMapping: ",parentChildLayerMapping);
    }

    if (hasParentLayer(layer.name)) {
      layer.elements.forEach((element) => {
        //console.log("element: ",element);
        //console.log("childTraits: ", childTraits);
        childTraits.forEach((childTrait) => {
          //console.log(`element.name: ${element.name}, childTrait: ${childTrait}`);
          if (element.name === childTrait) {
            let adjustedWeight = adjustWeight(childTrait, layer.name, _layers);
            let tempElement = Object.assign({},element);
            //console.log("elment before: ", element);
            tempElement.weight = adjustedWeight;
            //console.log("element after: ", element);
            pairLayer.push(tempElement);
            //console.log("pairLayer pushed: ", tempElement);
            backupPairLayer.push(element);

            totalWeight += adjustedWeight;
          }
        })
      });
      //console.log("pairLayer: ", pairLayer);
      //console.log("backupPairLayer: ", backupPairLayer);
    }
    else {
      layer.elements.forEach((element) => {
        totalWeight += element.weight;
      });
    }


    // number between 0 - totalWeight
    //let random = Math.floor(Math.random() * totalWeight);
    //RNG based on seed
    //console.log(pairTraitConfig)

    let random = Math.floor(rng() * totalWeight);

    if (hasParentLayer(layer.name)) {
      for (var i = 0; i < pairLayer.length; i++) {
        // subtract the current weight from the random weight until we reach a sub zero value.
        random -= pairLayer[i].weight;
        if (random < 0) {

          if (hasChildLayerBool) {
            let childTraitAndLayer = getChildTraitsAndLayer(pairLayer[i].name, layer.name);
            //console.log("childTraitAndLayer: ",childTraitAndLayer);
            childTraitAndLayer.forEach((element) => {
              childTraits.push(element.childTrait);
            })

            hasChildLayerBool = false;
          }
          
          pairLayer = backupPairLayer;
          return randNum.push(
            `${pairLayer[i].id}:${pairLayer[i].filename}${layer.bypassDNA ? "?bypassDNA=true" : ""
            }`
          );
        }
      }
    }
    else {
      for (var i = 0; i < layer.elements.length; i++) {
        // subtract the current weight from the random weight until we reach a sub zero value.
        random -= layer.elements[i].weight;
        if (random < 0) {
          // //pair traits based on pairTraitConfig
          // if(hasChildLayer(layer.name)) {
          //   //const childPair = getChildTraits(layer.elements[i].name);
          //   //traitPair.set(layer.elements[i].name, childPair);
          // }

          //might need to move this to before trait was selected
          if (hasChildLayerBool) {
            let childTraitAndLayer = getChildTraitsAndLayer(layer.elements[i].name, layer.name);
            //console.log("childTraitAndLayer: ", childTraitAndLayer);
            childTraitAndLayer.forEach((element) => {
              element.childTrait.forEach((childTrait => {
                childTraits.push(childTrait);
              }))
            })
            // if(childTraits) {
            //   parentChildTraitMapping.set(layer.elements[i].name, childTraits);

            // }
            hasChildLayerBool = false;
          }

          return randNum.push(
            `${layer.elements[i].id}:${layer.elements[i].filename}${layer.bypassDNA ? "?bypassDNA=true" : ""
            }`
          );
        }
      }
    }
  });
  //console.log("\n\n");
  return randNum.join(DNA_DELIMITER);
};


const writeMetaData = (_data) => {
  fs.writeFileSync(`${buildDir}/json/_metadata.json`, _data);
};

const saveMetaDataSingleFile = (_editionCount) => {
  let metadata = metadataList.find((meta) => meta.edition == _editionCount);
  debugLogs
    ? console.log(
      `Writing metadata for ${_editionCount}: ${JSON.stringify(metadata)}`
    )
    : null;
  fs.writeFileSync(
    `${buildDir}/json/${_editionCount}.json`,
    JSON.stringify(metadata, null, 2)
  );
};

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

const startCreating = async () => {
  let layerConfigIndex = 0;
  let editionCount = 1;
  let failedCount = 0;
  let abstractedIndexes = [];
  for (
    let i = network == NETWORK.sol ? 0 : 1;
    i <= layerConfigurations[layerConfigurations.length - 1].growEditionSizeTo;
    i++
  ) {
    abstractedIndexes.push(i);
  }
  if (shuffleLayerConfigurations) {
    abstractedIndexes = shuffle(abstractedIndexes);
  }
  debugLogs
    ? console.log("Editions left to create: ", abstractedIndexes)
    : null;
  while (layerConfigIndex < layerConfigurations.length) {
    const layers = layersSetup(
      layerConfigurations[layerConfigIndex].layersOrder
    );
    while (
      editionCount <= layerConfigurations[layerConfigIndex].growEditionSizeTo
    ) {
      let newDna = createDna(layers, pairTraitConfig);
      if (isDnaUnique(dnaList, newDna)) {
        let results = constructLayerToDna(newDna, layers);
        let loadedElements = [];

        results.forEach((layer) => {
          loadedElements.push(loadLayerImg(layer));
        });

        await Promise.all(loadedElements).then((renderObjectArray) => {
          debugLogs ? console.log("Clearing canvas") : null;
          ctx.clearRect(0, 0, format.width, format.height);
          if (gif.export) {
            hashlipsGiffer = new HashlipsGiffer(
              canvas,
              ctx,
              `${buildDir}/gifs/${abstractedIndexes[0]}.gif`,
              gif.repeat,
              gif.quality,
              gif.delay
            );
            hashlipsGiffer.start();
          }
          if (background.generate) {
            drawBackground();
          }
          renderObjectArray.forEach((renderObject, index) => {
            drawElement(
              renderObject,
              index,
              layerConfigurations[layerConfigIndex].layersOrder.length
            );
            if (gif.export) {
              hashlipsGiffer.add();
            }
          });
          if (gif.export) {
            hashlipsGiffer.stop();
          }
          debugLogs
            ? console.log("Editions left to create: ", abstractedIndexes)
            : null;
          saveImage(abstractedIndexes[0]);
          addMetadata(newDna, abstractedIndexes[0]);
          saveMetaDataSingleFile(abstractedIndexes[0]);
          console.log(
            `Created edition: ${abstractedIndexes[0]}, with DNA: ${sha1(
              newDna
            )}`
          );
        });
        dnaList.add(filterDNAOptions(newDna));
        editionCount++;
        abstractedIndexes.shift();
      } else {
        console.log("DNA exists!");
        failedCount++;
        if (failedCount >= uniqueDnaTorrance) {
          console.log(
            `You need more layers or elements to grow your edition to ${layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
          );
          process.exit();
        }
      }
    }
    layerConfigIndex++;
  }
  writeMetaData(JSON.stringify(metadataList, null, 2));
};

function hasChildLayer(_layersName) {
  let hasChild = false;
  pairTraitConfig.forEach(function (trait) {
    //console.log(`Checking for layer: ${_layersName}, hasChildLayer: ${_layersName == trait.parentLayer}`);
    if (_layersName == trait.parentLayer) {
      hasChild = true;
      return hasChild;
    }
  })
  return hasChild;
};

function hasParentLayer(_layersName) {
  let hasParent = false;
  pairTraitConfig.forEach(function (trait) {
    //console.log(`Checking for layer: ${_layersName}, hasParentLayer: ${_layersName == trait.childLayer} \n`);
    if (_layersName == trait.childLayer) {
      hasParent = true;
      return hasParent;
    }
  })
  return hasParent;
};

function getChildLayer(_parentLayer) {
  let childTraits = [];
  pairTraitConfig.forEach(function (trait) {
    if (_parentLayer == trait._parentLayer) {
      childTraits.push(trait.childLayer);
    }
  });
  //console.log("parentTraits: ", _parentLayer);
  //console.log("childTraits: ", childTraits);
  return childTraits;
}

function getChildTraitsAndLayer(_parentTrait, _parentLayer) {
  //console.log(`_parentTrait: ${_parentTrait}, _parentLayer: ${_parentLayer}`);
  let childTraitAndLayerStruct = {
    childTrait: "",
    childLayer: ""
  }
  let childTraitAndLayer = [];
  pairTraitConfig.forEach(function (trait) {
    trait.pairConfig.forEach(function (pair) {
      //console.log("pair: ", pair)
      if (_parentTrait == pair.parentTrait && _parentLayer == trait.parentLayer) {
        childTraitAndLayerStruct.childTrait = pair.childTrait;
        childTraitAndLayerStruct.childLayer = trait.childLayer;
        childTraitAndLayer.push(childTraitAndLayerStruct);
      }
    });
  });
  //console.log("parentTraits: ", _parentTrait);
  //console.log("childTraits: ", childTraits);
  return childTraitAndLayer;
}

//Need modification for all function that accepts input from a trait
//Need to consider different pairConfig that has name as childTrait from from different layer
//all input need to has childTrait and childLayer as a mapping to determine ParentLayer/Parent trait, and vice versa
function getParentTraitsAndLayer(_childTrait, _childLayer) {
  let parentTraitAndLayerStruct = {
    parentTrait: "",
    parentLayer: ""
  }
  let parentTraitAndLayer = [];
  pairTraitConfig.forEach((trait) => {
    trait.pairConfig.forEach((pair) => {
      pair.childTrait.forEach((childTrait => {
        if (_childTrait == childTrait && _childLayer == trait.childLayer) {
          //console.log("childTrait:", childTrait);
          parentTraitAndLayerStruct.parentTrait = pair.parentTrait;
          parentTraitAndLayerStruct.parentLayer = trait.parentLayer;
          parentTraitAndLayer.push(parentTraitAndLayerStruct);
        }
      }))
    })
  })

  return parentTraitAndLayer;
}

// function getLayerProbability(_layer) {
//   let probability = [];
//   let totalWeight = 0;
//   _layer.elements.forEach((element) => {
//     totalWeight += element.weight;
//   })

//   _layer.elements.forEach((element) => {
//     probability.push(element.weight/totalWeight);
//   })

//   console.log("return: ", probability)
//   return probability;
// }

// function getTraitProbability(_trait, _layer) {
//   let totalWeight = 0;
//   let traitProbability = 0;
//   _layer.forEach((layer) => {
//     layer.elements.forEach((element) => {
//       totalWeight += element.weight;
//     })

//     layer.elements.forEach((element) => {
//       if(element.name == _trait) {
//         console.log("totalWeight: ", totalWeight);
//         console.log("trait: ", _trait);
//         traitProbability = element.weight/totalWeight;
//         console.log("traitProbability: ", traitProbability);
//         return traitProbability;
//       }
//     })
//     totalWeight = 0;
//   })
//   return traitProbability;
// }

function getTraitProbabilityFromLayer(_trait, _layer, _layers) {
  let totalWeight = 0;
  let traitProbability = 0;
  _layers.forEach((layer) => {
    if (layer.name == _layer) {
      layer.elements.forEach((element) => {
        //console.log(`element name: ${element.name}, element weight: ${element.weight}`);
        totalWeight += element.weight;
      })

      layer.elements.forEach((element) => {
        if (element.name == _trait) {
          // console.log("totalWeight: ", totalWeight);
          // console.log("trait: ", _trait);
          traitProbability = element.weight / totalWeight;
          // console.log("traitProbability: ", traitProbability);
          // console.log("\n");
          return traitProbability;
        }
      })
    }
  })
  return traitProbability;
}

function adjustWeight(_childTrait, _childLayer, _layers) {
  let parentTraitAndLayer = [];
  let sumParentTraitProbability = 0;
  let childTraitProbability = 0;

  //Find all parent layer
  //Get all probability of all parent layer
  //Adjusted probability = desired probability/Sum of probability of parent trait

  //sum of propability of all parent traits
  parentTraitAndLayer = getParentTraitsAndLayer(_childTrait, _childLayer);
  parentTraitAndLayer.forEach(trait => {
    sumParentTraitProbability += getTraitProbabilityFromLayer(trait.parentTrait, trait.parentLayer, _layers);
  })
  // console.log("sumParentTraitProbability: ", sumParentTraitProbability);
  // console.log("_childTrait: ", _childTrait);
  // console.log("_childLayer: ", _childLayer);
  childTraitProbability = getTraitProbabilityFromLayer(_childTrait, _childLayer, _layers);
  //console.log("childTraitProbability: ", childTraitProbability);

  let adjustedProbability = childTraitProbability/sumParentTraitProbability;
  //4 zeroes because accuracy required is up to 4 Significant figures, can be change in the future
  let adjustWeight = adjustedProbability*10000;
  //console.log("adjustedWeight: ", adjustWeight);
  return adjustWeight;
}
// function getChildTraits(_parentTrait) {
//   let childTraits = [];
//   pairTraitConfig.forEach(function(trait) {
//     console.log("trait.parentTrait: ", trait.parentTrait);
//     if (trait.parentTrait === _parentTrait) {
//       childTraits = trait.childTraits;
//       return;
//     }
//   });
//   console.log("parentTraits: ", _parentTrait);
//   console.log("childTraits: ", childTraits);
//   return childTraits;
// }

module.exports = { startCreating, buildSetup, getElements };
