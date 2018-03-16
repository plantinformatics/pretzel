
// let minimum_length = 3;
// let continuity_threshold = 0.9;

function findLinks(featuresA, featuresB) {
    let links = [];
    add_link = function(f1, f2, alias) {
        let link = {featureA: f1, featureB: f2, alias: alias};
        links.push(link);
    }
    let features_a_by_name = {};
    featuresA.forEach(function(feature) {
        features_a_by_name[feature.name] = feature;
    });

    featuresB.forEach(function(feature_b) {
        if (feature_b.name in features_a_by_name) {
            add_link(features_a_by_name[feature_b.name], feature_b);
        } else {
            for (var i=0; i<feature_b.aliases.length; i++) {
                if (feature_b.aliases[i].string2 in features_a_by_name) {
                    add_link(features_a_by_name[feature_b.aliases[i].string2], feature_b, feature_b.aliases[i].__data);
                    break;
                }
            }
        }
        // clean up
        delete feature_b.aliases;
    });
    return links;
}

function loadAliases(models, block_a, block_b, options) {
    // append aliases to block b features
    let features_by_name = {};
    block_b.features.forEach(function(feature) {
        feature['aliases'] = [];
        features_by_name[feature.name] = feature;
    });

    // find relevant aliases
    let feature_b_names = Object.keys(features_by_name);
    let conditions = [{string1: {inq: feature_b_names}}];
    let conditions_mirror = [{string2: {inq: feature_b_names}}];
    if (block_b.dataset.namespace) {
        conditions.push({namespace1: block_b.dataset.namespace});
        conditions_mirror.push({namespace2: block_b.dataset.namespace});
    }
    if (block_a.dataset.namespace) {
        conditions.push({namespace2: block_a.dataset.namespace});
        conditions_mirror.push({namespace1: block_a.dataset.namespace});
    }
    let where = {where: {or: [{and: conditions}, {and: conditions_mirror}]}};
    return models.Alias.find(where, options)
    .then(function(aliases) {
        // match aliases to the features on blockB
        aliases.forEach(function(alias) {
            if (alias.namespace1 == block_b.dataset.namespace && alias.string1 in features_by_name) {
                features_by_name[alias.string1]['aliases'].push(alias);
            } else if (alias.namespace2 == block_b.dataset.namespace && alias.string2 in features_by_name) {
                let alias_mirror = Object.assign({}, alias);
                alias_mirror.namespace1 = alias.namespace2;
                alias_mirror.namespace2 = alias.namespace1;
                alias_mirror.string1 = alias.string2;
                alias_mirror.string2 = alias.string1;
                features_by_name[alias_mirror.string1]['aliases'].push(alias_mirror);
            }
        });
        return {featuresA: block_a.features, featuresB: block_b.features};
    });
}

function findSequences(links, links_b) {
    let blocks = [];
    let block_links = [];
    let block_oos_links = [];
    
    let reverse = false;

    for (let i=0; i<links.length; i++) {
        let link = links[i];
        let prev_link = links[i-1];
        if (prev_link) {
            let b_diff = link.index_b - prev_link.index_b;
            // if not already tracking a sequence
            if (block_links.length == 0) {
                if (b_diff == -1 || b_diff == 1) {
                    // new sequence found
                    reverse = (b_diff == -1);
                    block_links.push(prev_link);
                    block_links.push(link);
                }
            } else {
                if (reverse) { b_diff *= -1 }
                // if this link fits into the currently tracked sequence
                if (b_diff == 1) {
                    block_links.push(link);
                } else {
                    // broken sequence
                    // check threshold
                    let allow_oos = (1-continuity_threshold) * (block_links.length + block_oos_links.length +1) - block_oos_links.length;
                    allow_oos = Math.floor(allow_oos);
                    let skips = Infinity;
                    let a_skip = null;
                    let b_skip = null;

                    if (allow_oos >= 1) {
                        // look forward to see if we can skip a few links
                        for (let a_index_offset=0; a_index_offset<allow_oos; a_index_offset++) {
                            let potential_next = links[a_index_offset+i];
                            if (potential_next) {
                                let b_index_offset = links[a_index_offset+i].index_b - prev_link.index_b;
                                if (reverse) { b_index_offset *= -1 }
                                b_index_offset -= 1;
                                if (b_index_offset > 0) {
                                    let offset_required = a_index_offset + b_index_offset;
                                    // found solution
                                    if (offset_required <= allow_oos) {
                                        if (offset_required < skips) {
                                            allow_oos = offset_required;
                                            skips = offset_required;
                                            a_skip = a_index_offset;
                                            b_skip = b_index_offset;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // if found solution
                    if (skips <= allow_oos) {
                        block_links.push(links[i + a_skip]);
                        for (let a_index_offset=0; a_index_offset<a_skip; a_index_offset++) {
                            block_oos_links.push(links[i+a_index_offset]);
                        }
                        for (let b_index_offset=0; b_index_offset<b_skip; b_index_offset++) {
                            let index_b = prev_link.index_b + ((b_index_offset + 1) * (reverse?-1:1));
                            block_oos_links.push(links_b[index_b]);
                        }
                        i += a_skip;
                    } else {
                        if (block_links.length >= minimum_length) {
                            // save current sequence as synteny block
                            blocks.push({links: block_links, oos_links: block_oos_links});
                        }
                        // reset sequence
                        block_links = [];
                        block_oos_links = [];
                    }
                }
            }
        }
    }
    // add final sequence
    if (block_links.length >= minimum_length) {
        blocks.push({links: block_links, oos_links: block_oos_links});
    }
    return blocks;
}

function normalizeBlocks(blocks) {
    blocks.forEach(function(block) {
        let a_start = block.links[0].index_a;
        let a_end = block.links[block.links.length-1].index_a;
        let b_start = block.links[0].index_b;
        let b_end = block.links[block.links.length-1].index_b;
        reverse = false;
        if (a_start < a_end && b_start > b_end || 
            a_start > a_end && b_start < b_end) {
            reverse = true;
        }

        block['reverse'] = reverse;
        block['a_range'] = a_start < a_end? [a_start, a_end] : [a_end, a_start];
    });

    //sort
    blocks.sort(function(a, b) {
        if (a.a_range[0] == b.a_range[0]) {
            return a.a_range[1] - b.a_range[1];
        }
        return a.a_range[0] - b.a_range[0];
    });

    //remove overlaps
    let i = blocks.length;
    while(i--) {
        let block = blocks[i];
        if (i>0) {
            let prev_block = blocks[i-1];
            if (prev_block.a_range[1] > block.a_range[0]) {
                //overlap
                if (prev_block.reverse == block.reverse) {
                    //merge
                    block.links.forEach(function(link) {
                        if (link.index_a > prev_block.a_range[1]) {
                            prev_block.links.push(link);
                        }
                    });
                    block.oos_links.forEach(function(link) {
                        let found = false;
                        prev_block.oos_links.forEach(function(link2) {
                            if (link2.name == link.name) {
                                found = true
                            }
                        });
                        if (!found) {
                            prev_block.oos_links.push(link);
                        }
                    });
                    prev_block.a_range[1] = block.a_range[1];
                    blocks.splice(i, 1);
                } else {
                    //trim
                    //which block to trim
                    let trim_prev = false;
                    if (block.links.length > prev_block.links.length) {
                        trim_prev = true;
                    }
                    if (trim_prev) {
                        prev_block.a_range[1] = block.a_range[0] - 1;
                        prev_block = trimBlock(prev_block);
                        if (prev_block == null) {
                            blocks.splice(i-1, 1);
                        }
                    } else {
                        block.a_range[0] = prev_block.a_range[1] + 1;
                        block = trimBlock(block);
                        if (block == null) {
                            blocks.splice(i, 1);
                        }
                    }
                }
            }
        }
    }
    return blocks;
}

function trimBlock(block) {
    let i = block.links.length;
    while (i--) {
        let link = block.links[i];
        if (link.index_a < block.a_range[0] || link.index_a > block.a_range[1]) {
            block.links.splice(i, 1);
        }
    }
    if (block.links.length < minimum_length) {
        return null;
    }
    i = block.oos_links.length;
    while (i--) {
        let link = block.oos_links[i];
        if (link.index_a < block.a_range[0] || link.index_a > block.a_range[1]) {
            block.oos_links.splice(i, 1);
        }
    }
    let a_start = block.links[0].index_a;
    let a_end = block.links[block.links.length-1].index_a;
    block.a_range = a_start < a_end? [a_start, a_end] : [a_end, a_start];
    return block;
}

function findBlocks(block_a, block_b) {
    let links = findLinks(block_a, block_b);
    // sort the list of links by position in block B
    links.sort(function(a, b) {
        if (a.pos_b == b.pos_b) {
            if (a.pos_a == b.pos_a) {
                if (a.name < b.name) { return -1 }
                if (a.name > b.name) { return 1 }
            }
            return a.pos_a - b.pos_a;
        }
        return a.pos_b - b.pos_b;
    });
    // save the order in which the links appear in block B
    for (let i=0; i<links.length; i++) {
        links[i]['index_b'] = i;
    }
    let links_b = links.slice(0);
    // now sort the links by position in block A
    // both sorts compare multiple properties to make the order consistent across both lists
    links.sort(function(a, b) {
        if (a.pos_a == b.pos_a) {
            if (a.pos_b == b.pos_b) {
                if (a.name < b.name) { return -1 }
                if (a.name > b.name) { return 1 }
            }
            return a.pos_b - b.pos_b;
        }
        return a.pos_a - b.pos_a;
    });
    // save the order for reference
    for (let i=0; i<links.length; i++) {
        links[i]['index_a'] = i;
    }

    // do forward pass
    let blocks = findSequences(links, links_b);
    // do backward pass
    links.reverse();
    blocks = blocks.concat(findSequences(links, links_b));
    blocks = normalizeBlocks(blocks);
    return blocks;    
}

/**
 * Request block data for id
 * @param {Object} models - Loopback database models
 * @param {String} id - The specific block identifier on database
 */
function findBlock(models, id, options) {
    return models.Block.findById(id, {include: ['features', 'dataset']}, options);
}

/**
 * Request data for two blocks concurrently
 * @param {Object} models - Loopback database models
 * @param {String} id_left - The specific block identifier on database
 * @param {String} id_right - The specific block identifier on database
 */
function findBlockPair(models, id_left, id_right, options) {
    let promise_a = findBlock(models, id_left, options);
    let promise_b = findBlock(models, id_right, options);
    return promise_a.then(function(block_a) {
        return promise_b.then(function(block_b) {
            return {blockA: block_a.__data, blockB: block_b.__data};
        });
    });
}
  
exports.paths = function(models, id0, id1, options) {
    return findBlockPair(models, id0, id1, options)
    .then(function(data) {
        return loadAliases(models, data.blockA, data.blockB, options);
    }).then(function(data) {
        return findLinks(data.featuresA, data.featuresB);
    });
}

exports.syntenies = function(models, id0, id1, thresholdSize, thresholdContinuity) {

    let minimum_length = thresholdSize || 20;
    let continuity_threshold = thresholdContinuity || 0.9;

    return findBlockPair(models, id0, id1, thresholdSize, thresholdContinuity)
    .then(function(data) {
        return findBlocks(data.left, data.right)
    })
}