const {pool} = require('../../../config/database');
const {logger} = require('../../../config/winston');
const resApi = require('../../../config/functions');

/** 찜목록 추가
 POST /profile/wish
 productWishStatus = 1 찜한 목록으로 추가
 productWishStatus = 0 찜한 목록에서 해제
 **/
exports.postWish = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const productIdx = req.body.productIdx;
    const productColorIdx = req.body.productColorIdx;
    const productSizeIdx = req.body.productSizeIdx;
    const productWishStatus = req.body.productWishStatus;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            /** 예외(상품 존재 x) **/
            const existProductQuery = `select exists(select productIdx from product where productIdx = ?) exist;`;
            const [existProductResult] = await connection.query(existProductQuery, productIdx);
            if (!existProductResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 300, "존재하지 않는 상품입니다."));
            }
            /** 새로 추가 **/
            const productOptionQuery = `select productOptionStatus from product where productIdx = ?;`;
            const [productOptionResult] = await connection.query(productOptionQuery, productIdx);
            /** 3. 찜 수량/색상/사이즈 새로 추가 **/
            if (productWishStatus === 1) {
                /** 이미 색상/사이즈 찜목록에 존재 **/
                const existWishQuery = `select exists(select productIdx from wish where userIdx = ? and productIdx = ? and productColorIdx = ? and productSizeIdx = ?) exist;`;
                const existWishParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
                const [existWishResult] = await connection.query(existWishQuery, existWishParams);
                console.log(existWishResult[0].exist);
                if (existWishResult[0].exist) {
                    connection.release();
                    return res.json(resApi(false, 301, "이미 색상/사이즈 찜목록에 존재합니다."));
                }
                /** 이미 색상 찜목록에 존재 **/
                const existWishColorQuery = `select exists(select productIdx from wish where userIdx = ? and productIdx = ? and productColorIdx = ?) exist;`;
                const existWishColorParams = [userIdx, productIdx, productColorIdx];
                const [existWishColorResult] = await connection.query(existWishColorQuery, existWishColorParams);
                console.log(existWishResult[0].exist);
                if (existWishColorResult[0].exist) {
                    connection.release();
                    return res.json(resApi(false, 302, "이미 색상 찜목록에 존재합니다."));
                }
                /** 이미 찜목록에 존재 **/
                const existWishCountQuery = `select exists(select productIdx from wish where userIdx = ? and productIdx = ?) exist;`;
                const existWishCountParams = [userIdx, productIdx];
                const [existWishCountResult] = await connection.query(existWishCountQuery, existWishCountParams);
                console.log(existWishCountResult[0].exist);
                if (existWishCountResult[0].exist) {
                    connection.release();
                    return res.json(resApi(false, 303, "이미 찜목록에 존재합니다."));
                }
                if (productOptionResult[0].productOptionStatus === 3) {
                    const existOptionColorQuery = `select exists(select productIdx, productColorIdx from optionColor where productIdx = ? and productColorIdx = ?) exist;`;
                    const existOptionColorParams = [productIdx, productColorIdx];
                    const [existOptionColorResult] = await connection.query(existOptionColorQuery, existOptionColorParams);
                    if (existOptionColorResult[0].exist === 0) {
                        connection.release();
                        return res.json(resApi(false, 300, "존재하지 않는 색상입니다."));
                    };

                    const existOptionSizeQuery = `select exists(select productIdx, productSizeIdx from optionSize where productIdx = ? and productSizeIdx = ?) exist;`;
                    const existOptionSizeParams = [productIdx, productSizeIdx];
                    const [existOptionSizeResult] = await connection.query(existOptionSizeQuery, existOptionSizeParams);
                    if (existOptionSizeResult[0].exist === 0) {
                        connection.release();
                        return res.json(resApi(false, 301, "존재하지 않는 사이즈입니다."));
                    };
                    /** wish 테이블에 추가 **/
                    const insertWishQuery = `insert into wish (userIdx, productIdx, productColorIdx, productSizeIdx) values (?,?,?,?);`;
                    const insertWishParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
                    const [insertWishResult] = await connection.query(insertWishQuery, insertWishParams);

                    const updateProductWishStatus = `update product set productWishStatus = 1 where productIdx = ?;`;
                    const [updateProductWishResult] = await connection.query(updateProductWishStatus, productIdx);

                    let responseData = {};
                    responseData = resApi(true, 100, "찜");
                    responseData.result = insertWishResult;
                    connection.release();
                    return res.json(responseData)
                }

                /** 2. 찜 수량/색상 새로 추가 **/
                if (productOptionResult[0].productOptionStatus === 2) {
                    const existOptionColorQuery = `select exists(select productIdx, productColorIdx from optionColor where productIdx = ? and productColorIdx = ?) exist;`;
                    const existOptionColorParams = [productIdx, productColorIdx];
                    const [existOptionColorResult] = await connection.query(existOptionColorQuery, existOptionColorParams);
                    if (existOptionColorResult[0].exist === 0) {
                        connection.release();
                        return res.json(resApi(false, 300, "존재하지 않는 색상입니다."));
                    };
                    const insertWishQuery = `insert into wish (userIdx, productIdx, productColorIdx) values (?,?,?);`;
                    const insertWishParams = [userIdx, productIdx, productColorIdx];
                    const [insertWishResult] = await connection.query(insertWishQuery, insertWishParams);

                    const updateProductWishStatus = `update product set productWishStatus = 1 where productIdx = ?;`;
                    const [updateProductWishResult] = await connection.query(updateProductWishStatus, productIdx);

                    let responseData = {};
                    responseData = resApi(true, 101, "찜");
                    responseData.result = insertWishResult;
                    connection.release();
                    return res.json(responseData)
                }

                /** 1. 찜 수량 새로 추가 **/
                if (productOptionResult[0].productOptionStatus === 1) {
                    const insertWishQuery = `insert into wish (userIdx, productIdx) values (?,?);`;
                    const insertWishParams = [userIdx, productIdx];
                    const [insertWishResult] = await connection.query(insertWishQuery, insertWishParams);

                    const updateProductWishStatus = `update product set productWishStatus = 1 where productIdx = ?;`;
                    const [updateProductWishResult] = await connection.query(updateProductWishStatus, productIdx);

                    let responseData = {};
                    responseData = resApi(true, 101, "찜");
                    responseData.result = insertWishResult;
                    connection.release();
                    return res.json(responseData)
                }
            }
            if (productWishStatus === 0) {
                /** 3. 찜 삭제 **/
                if (productOptionResult[0].productOptionStatus === 3) {
                    /** 이미 색상/사이즈 찜목록에 존재 **/
                    const existWishQuery = `select exists(select productIdx from wish where userIdx = ? and productIdx = ? and productColorIdx = ? and productSizeIdx = ?) exist;`;
                    const existWishParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
                    const [existWishResult] = await connection.query(existWishQuery, existWishParams);
                    console.log(existWishResult[0].exist);
                    if (!existWishResult[0].exist) {
                        connection.release();
                        return res.json(resApi(false, 301, "색상/사이즈 찜목록에 존재하지않습니다.."));
                    }

                    const existOptionColorQuery = `select exists(select productIdx, productColorIdx from optionColor where productIdx = ? and productColorIdx = ?) exist;`;
                    const existOptionColorParams = [productIdx, productColorIdx];
                    const [existOptionColorResult] = await connection.query(existOptionColorQuery, existOptionColorParams);
                    if (existOptionColorResult[0].exist === 0) {
                        connection.release();
                        return res.json(resApi(false, 300, "존재하지 않는 색상입니다."));
                    };

                    const existOptionSizeQuery = `select exists(select productIdx, productSizeIdx from optionSize where productIdx = ? and productSizeIdx = ?) exist;`;
                    const existOptionSizeParams = [productIdx, productSizeIdx];
                    const [existOptionSizeResult] = await connection.query(existOptionSizeQuery, existOptionSizeParams);
                    if (existOptionSizeResult[0].exist === 0) {
                        connection.release();
                        return res.json(resApi(false, 301, "존재하지 않는 사이즈입니다."));
                    };
                    /** wish 테이블에 추가 **/
                    const deleteWishQuery = `delete from wish where userIdx =? and productIdx =? and productColorIdx =? and productSizeIdx = ?;`;
                    const deleteWishParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
                    const [deleteWishResult] = await connection.query(deleteWishQuery, deleteWishParams);

                    const updateProductWishStatus = `update product set productWishStatus = 0 where productIdx = ?;`;
                    const [updateProductWishResult] = await connection.query(updateProductWishStatus, productIdx);

                    let responseData = {};
                    responseData = resApi(true, 201, "찜 취소");
                    responseData.result = deleteWishResult;
                    connection.release();
                    return res.json(responseData)
                }

                /** 2. 찜 수량/색상 새로 삭제 **/
                if (productOptionResult[0].productOptionStatus === 2) {
                    /** 이미 색상 찜목록에 존재 **/
                    const existWishColorQuery = `select exists(select productIdx from wish where userIdx = ? and productIdx = ? and productColorIdx = ?) exist;`;
                    const existWishColorParams = [userIdx, productIdx, productColorIdx];
                    const [existWishColorResult] = await connection.query(existWishColorQuery, existWishColorParams);
                    console.log(existWishResult[0].exist);
                    if (!existWishColorResult[0].exist) {
                        connection.release();
                        return res.json(resApi(false, 302, "색상 찜목록에 존재하지않습니다."));
                    }

                    const existOptionColorQuery = `select exists(select productIdx, productColorIdx from optionColor where productIdx = ? and productColorIdx = ?) exist;`;
                    const existOptionColorParams = [productIdx, productColorIdx];
                    const [existOptionColorResult] = await connection.query(existOptionColorQuery, existOptionColorParams);
                    if (existOptionColorResult[0].exist === 0) {
                        connection.release();
                        return res.json(resApi(false, 300, "존재하지 않는 색상입니다."));
                    };
                    const deleteWishQuery = `delete from wish where userIdx = ? and productIdx = ? and productColorIdx = ?;`;
                    const deleteWishParams = [userIdx, productIdx, productColorIdx];
                    const [deleteWishResult] = await connection.query(deleteWishQuery, deleteWishParams);

                    const updateProductWishStatus = `update product set productWishStatus = 0 where productIdx = ?;`;
                    const [updateProductWishResult] = await connection.query(updateProductWishStatus, productIdx);

                    let responseData = {};
                    responseData = resApi(true, 201, "찜 취소");
                    responseData.result = deleteWishResult;
                    connection.release();
                    return res.json(responseData)
                }

                /** 1. 수량 새로 삭제 **/
                if (productOptionResult[0].productOptionStatus === 1) {
                    /** 이미 색상 찜목록에 존재 **/
                    const existWishQuery = `select exists(select productIdx from wish where userIdx = ? and productIdx = ?) exist;`;
                    const existWishParams = [userIdx, productIdx];
                    const [existWishResult] = await connection.query(existWishQuery, existWishParams);
                    if (!existWishResult[0].exist) {
                        connection.release();
                        return res.json(resApi(false, 303, "존재하지 않습니다."));
                    }

                    const deleteWishQuery = `delete from wish where userIdx = ? and productIdx = ?;`;
                    const deleteWishParams = [userIdx, productIdx];
                    const [deleteWishResult] = await connection.query(deleteWishQuery, deleteWishParams);

                    const updateProductWishStatus = `update product set productWishStatus = 0 where productIdx = ?;`;
                    const [updateProductWishResult] = await connection.query(updateProductWishStatus, productIdx);

                    let responseData = {};
                    responseData = resApi(true, 201, "찜 취소");
                    responseData.result = deleteWishResult;
                    connection.release();
                    return res.json(responseData)
                }
            }
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};

/** 찜리스트에서 장바구니 담기
 POST /profile/wish/list
 wishCartStatus = 1 -> 장바구니 담기
 -> 장바구니 추가시 update 되게끔
 wishCartStatus = 2 -> 찜목록에서 삭제
 **/
exports.postWishCart = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const productIdx = req.body.productIdx;
    const productColorIdx = req.body.productColorIdx;
    const productSizeIdx = req.body.productSizeIdx;
    const wishCartStatus = req.body.wishCartStatus;

    try {
        const connection = await pool.getConnection(async conn => conn());
        try {

            if (wishCartStatus === 1) {
                const insertCartQuery = `insert into cart(userIdx, productIdx, productColorIdx, productSizeIdx, productTotalPrice)
                                            select W.userIdx, W.productIdx, W.productColorIdx, W.productSizeIdx, P.productPrice
                                             from wish W
                                             left join product P
                                             on W.productIdx = P.productIdx
                                              where W.userIdx = ? and W.productIdx = ? and W.productColorIdx = ? and W.productSizeIdx = ?;`;
                const insertCartParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
                const [insertCartResult] = await connection.query(insertCartQuery, insertCartParams);

                let responseData = {};
                responseData = resApi(true, 100, "찜목록 장바구니 추가");
                responseData.insertCartResult = insertCartResult;
                connection.release();
                return res.json(responseData);
            }

            if (wishCartStatus === 2) {
                /** 구매목록 상품 존재 x **/
                const existOrderProductQuery = `select exists(select productIdx from wish where userIdx = ? and productIdx = ?) exist;`;
                const existOrderProductParams = [userIdx, productIdx];
                const [existOrderProductResult] = await connection.query(existOrderProductQuery, existOrderProductParams);
                if (!existOrderProductResult[0].exist) {
                    connection.release();
                    return res.json(resApi(false, 300, "상품이 존재하지 않습니다."));
                }

                const productOptionQuery = `select productOptionStatus from product where productIdx = ?;`;
                const [productOptionResult] = await connection.query(productOptionQuery, productIdx);

                /** 3. 배송목록에서 수량/색상/사이즈 삭제 **/
                if (productOptionResult[0].productOptionStatus === 3) {
                    const existOptionColorQuery = `select exists(select productIdx, productColorIdx from optionColor where productIdx = ? and productColorIdx = ?) exist;`;
                    const existOptionColorParams = [productIdx, productColorIdx];
                    const [existOptionColorResult] = await connection.query(existOptionColorQuery, existOptionColorParams);
                    if (existOptionColorResult[0].exist === 0) {
                        connection.release();
                        return res.json(resApi(false, 301, "존재하지 않는 색상입니다."));
                    };

                    const existOptionSizeQuery = `select exists(select productIdx, productSizeIdx from optionSize where productIdx = ? and productSizeIdx = ?) exist;`;
                    const existOptionSizeParams = [productIdx, productSizeIdx];
                    const [existOptionSizeResult] = await connection.query(existOptionSizeQuery, existOptionSizeParams);
                    if (existOptionSizeResult[0].exist === 0) {
                        connection.release();
                        return res.json(resApi(false, 302, "존재하지 않는 사이즈입니다."));
                    };

                    const deleteOrderInfoQuery = `delete from wish where userIdx = ? and productIdx = ? and productColorIdx = ? and productSizeIdx =?;`;
                    const deleteOrderInfoParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
                    const [deleteOrderInfoResult] = await connection.query(deleteOrderInfoQuery, deleteOrderInfoParams);

                    let responseData = {};
                    responseData = resApi(true, 103, "찜목록 삭제(수량/색상/사이즈)");
                    responseData.result = deleteOrderInfoResult;
                    connection.release();
                    return res.json(responseData)
                }

                /** 2. 수량/색상 새로 삭제 **/
                if (productOptionResult[0].productOptionStatus === 2) {
                    const existOptionColorQuery = `select exists(select productIdx, productColorIdx from optionColor where productIdx = ? and productColorIdx = ?) exist;`;
                    const existOptionColorParams = [productIdx, productColorIdx];
                    const [existOptionColorResult] = await connection.query(existOptionColorQuery, existOptionColorParams);
                    if (existOptionColorResult[0].exist === 0) {
                        connection.release();
                        return res.json(resApi(false, 301, "존재하지 않는 색상입니다."));
                    };
                    const deleteOrderInfoQuery = `delete from wish where userIdx = ? and productIdx = ? and productColorIdx = ?;`;
                    const deleteOrderInfoParams = [userIdx, productIdx, productColorIdx];
                    const [deleteOrderInfoResult] = await connection.query(deleteOrderInfoQuery, deleteOrderInfoParams);

                    let responseData = {};
                    responseData = resApi(true, 102, "찜목록 삭제(수량/색상)");
                    responseData.result = deleteOrderInfoResult;
                    connection.release();
                    return res.json(responseData)
                }

                /** 1. 수량 새로 삭제 **/
                if (productOptionResult[0].productOptionStatus === 1) {
                    const deleteOrderInfoQuery = `delete from wish where userIdx = ? and productIdx = ? ;`;
                    const deleteOrderInfoParams = [userIdx, productIdx];
                    const [deleteOrderInfoResult] = await connection.query(deleteOrderInfoQuery, deleteOrderInfoParams);

                    let responseData = {};
                    responseData = resApi(true, 101, "찜목록 삭제(수량)");
                    responseData.result = deleteOrderInfoResult;
                    connection.release();
                    return res.json(responseData)
                }
            }

        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};


/** 찜목록 조회
 GET /profile/wish/list
 **/
exports.getWish = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            const existWishListQuery = `select exists(select productIdx from wish where userIdx = ?) exist;`;
            const [existWishListResult] = await connection.query(existWishListQuery, userIdx);
            if (!existWishListResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 300, "찜목록에 상품이 없습니다."));
            }

            const wishListQuery = `select P.productName, P.productPrice, P.productImgUrl, OC.productColor, OS.productSize, P.productCoupangStatus
                                            from wish W
                                            left join product P
                                            on W.productIdx = P.productIdx
                                            left join optionColor OC
                                            on OC.productIdx = W.productIdx and OC.productColorIdx = W.productColorIdx
                                            left join optionSize OS
                                            on OS.productIdx = W.productIdx and OS.productSizeIdx = W.productSizeIdx
                                            where W.userIdx = ?;`;
            const [wishListResult] = await connection.query(wishListQuery, userIdx);

            let responseData = {};
            responseData = resApi(true, 100, "찜목록 조회");
            responseData.wishListResult = wishListResult;
            connection.release();
            return res.json(responseData);
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};
