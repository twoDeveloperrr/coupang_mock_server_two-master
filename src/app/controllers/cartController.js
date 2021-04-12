const {pool} = require('../../../config/database');
const {logger} = require('../../../config/winston');
const resApi = require('../../../config/functions');

/** 장바구니 담기
 POST /product/:productIdx/cart
 1. 수량
 2. 색상/수량
 3. 사이즈/색상/수량
 **/
exports.postOptionCartProduct = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const productIdx = req.params.productIdx;

    const productColorIdx = req.body.productColorIdx;
    const productSizeIdx = req.body.productSizeIdx;
    const productCount = req.body.productCount;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            /** 수량/색상/사이즈 **/
            // 만약 같은 제품의 담기면 수량 업데이트
            const getExistCartProductColorSizeQuery =`select exists(select productIdx, userIdx, productColorIdx, productSizeIdx from cart where userIdx = ? and productIdx = ? and productColorIdx = ? and productSizeIdx = ?) as exist;`;
            const getExistCartProductColorSizeParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
            const [getExistCartProductColorSizeResult] = await connection.query(getExistCartProductColorSizeQuery, getExistCartProductColorSizeParams);
            if (getExistCartProductColorSizeResult[0].exist === 1){
                // 수량추가
                const updateCartProductCountQuery = `update cart set productCount =
                                                            (select productCount
                                                                from (select productCount
                                                                        from cart
                                                                            where userIdx = ? and productIdx = ? and productColorIdx = ? and productSizeIdx = ?) productCount) + ?
                                                    where userIdx =? and productIdx = ? and productColorIdx = ? and productSizeIdx = ?;`;
                const updateCartProductCountParams = [userIdx, productIdx, productColorIdx, productSizeIdx, productCount, userIdx, productIdx, productColorIdx, productSizeIdx];
                const [updateCartProductResult] = await connection.query(updateCartProductCountQuery, updateCartProductCountParams);

                // 수량만큼의 가격추가
                const updateCartProductPriceQuery = `update cart set productTotalPrice =
                                                        productTotalPrice + (? * (select productPrice
                                                                                    from (select productPrice
                                                                                            from product
                                                                                                where productIdx = ?) productPrice))
                                                    where userIdx = ? and productIdx = ? and productColorIdx = ? and productSizeIdx = ?;`;
                const updateCartProductPriceParams = [productCount, productIdx, userIdx, productIdx, productColorIdx, productSizeIdx];
                const [updateCartProductPriceResult] = await connection.query(updateCartProductPriceQuery, updateCartProductPriceParams);

                let responseData = {};
                responseData = resApi(true, 100, "장바구니추가");
                responseData.productCountResult = updateCartProductResult;
                responseData.productPriceResult = updateCartProductPriceResult;
                connection.release();
                return res.json(responseData)
            }

            /** 새로 추가 **/
            const productOptionQuery = `select productOptionStatus from product where productIdx = ?;`;
            const [productOptionResult] = await connection.query(productOptionQuery, productIdx);
            /** 3. 수량/색상/사이즈 새로 추가 **/
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

                const insertCartQuery = `insert into cart (userIdx, productIdx, productColorIdx, productSizeIdx, productCount, productTotalPrice) values (?,?,?,?,?,? * (select productPrice from (select productPrice from product where productIdx = ?) productPrice));`;
                const insertCartParams = [userIdx, productIdx, productColorIdx, productSizeIdx, productCount, productCount, productIdx];
                const [insertCartResult] = await connection.query(insertCartQuery, insertCartParams);

                let responseData = {};
                responseData = resApi(true, 100, "장바구니담기");
                responseData.result = insertCartResult;
                connection.release();
                return res.json(responseData)
            }
            /** 같은 수량/색상 존재시 **/
            const getExistCartProductColorQuery =`select exists(select productIdx, productColorIdx from cart where userIdx = ? and productIdx = ? and productColorIdx = ?) as exist;`;
            const getExistCartProductColorParams = [userIdx, productIdx, productColorIdx];
            const [isExistProductColor] = await connection.query(getExistCartProductColorQuery, getExistCartProductColorParams);
            if(isExistProductColor[0].exist === 1){
                // 수량추가
                const updateCartProductCountQuery = `update cart set productCount =
                                                            (select productCount
                                                                from (select productCount
                                                                        from cart
                                                                            where userIdx = ? and productIdx = ? and productColorIdx = ?) productCount) + ?
                                                    where userIdx =? and productIdx = ? and productColorIdx = ?;`;
                const updateCartProductCountParams = [userIdx, productIdx, productColorIdx, productCount, userIdx, productIdx, productColorIdx];
                const [updateCartProductResult] = await connection.query(updateCartProductCountQuery, updateCartProductCountParams);

                // 수량만큼의 가격추가
                const updateCartProductPriceQuery = `update cart set productTotalPrice =
                                                        productTotalPrice + (? * (select productPrice
                                                                                    from (select productPrice
                                                                                            from product
                                                                                                where productIdx = ?) productPrice))
                                                    where userIdx = ? and productIdx = ? and productColorIdx = ?;`;
                const updateCartProductPriceParams = [productCount, productIdx, userIdx, productIdx, productColorIdx];
                const [updateCartProductPriceResult] = await connection.query(updateCartProductPriceQuery, updateCartProductPriceParams);

                let responseData = {};
                responseData = resApi(true, 100, "장바구니추가");
                responseData.productCountResult = updateCartProductResult;
                responseData.productPriceResult = updateCartProductPriceResult;
                connection.release();
                return res.json(responseData)
            }

            /** 2. 수량/색상 새로 추가 **/
            if (productOptionResult[0].productOptionStatus === 2) {
                const existOptionColorQuery = `select exists(select productIdx, productColorIdx from optionColor where productIdx = ? and productColorIdx = ?) exist;`;
                const existOptionColorParams = [productIdx, productColorIdx];
                const [existOptionColorResult] = await connection.query(existOptionColorQuery, existOptionColorParams);
                if (existOptionColorResult[0].exist === 0) {
                    connection.release();
                    return res.json(resApi(false, 300, "존재하지 않는 색상입니다."));
                };
                const insertCartQuery = `insert into cart (userIdx, productIdx, productColorIdx, productCount, productTotalPrice) values (?,?,?,?,? * (select productPrice from (select productPrice from product where productIdx = ?) productPrice));`;
                const insertCartParams = [userIdx, productIdx, productColorIdx, productCount, productCount, productIdx];
                const [insertCartResult] = await connection.query(insertCartQuery, insertCartParams);

                let responseData = {};
                responseData = resApi(true, 101, "장바구니담기");
                responseData.result = insertCartResult;
                connection.release();
                return res.json(responseData)
            }

            /** 같은 수량 존재 시 추가 **/
            const getExistCartProductQuery =`select exists(select productIdx, userIdx from cart where userIdx = ? and productIdx = ?) as exist;`;
            const getExistCartProductParams = [userIdx, productIdx];
            const [getExistCartProductResult] = await connection.query(getExistCartProductQuery, getExistCartProductParams);
            if(getExistCartProductResult[0].exist === 1){
                // 수량추가
                const updateCartProductCountQuery = `update cart set productCount =
                                                            (select productCount
                                                                from (select productCount
                                                                        from cart
                                                                            where userIdx = ? and productIdx = ?) productCount) + ?
                                                    where userIdx =? and productIdx = ?;`;
                const updateCartProductCountParams = [userIdx, productIdx, productCount, userIdx, productIdx];
                const [updateCartProductResult] = await connection.query(updateCartProductCountQuery, updateCartProductCountParams);

                // 수량만큼의 가격추가
                const updateCartProductPriceQuery = `update cart set productTotalPrice =
                                                        productTotalPrice + (? * (select productPrice
                                                                                    from (select productPrice
                                                                                            from product
                                                                                                where productIdx = ?) productPrice))
                                                    where userIdx = ? and productIdx = ?;`;
                const updateCartProductPriceParams = [productCount, productIdx, userIdx, productIdx];
                const [updateCartProductPriceResult] = await connection.query(updateCartProductPriceQuery, updateCartProductPriceParams);

                let responseData = {};
                responseData = resApi(true, 100, "장바구니추가");
                responseData.productCountResult = updateCartProductResult;
                responseData.productPriceResult = updateCartProductPriceResult;
                connection.release();
                return res.json(responseData)
            }

            /** 1. 수량 새로 추가 **/
            if (productOptionResult[0].productOptionStatus === 1) {
                const insertCartQuery = `insert into cart (userIdx, productIdx, productCount, productTotalPrice) values (?,?,?,? * (select productPrice from (select productPrice from product where productIdx = ?) productPrice));`;
                const insertCartParams = [userIdx, productIdx, productCount, productCount, productIdx];
                const [insertCartResult] = await connection.query(insertCartQuery, insertCartParams);

                let responseData = {};
                responseData = resApi(true, 101, "장바구니담기");
                responseData.result = insertCartResult;
                connection.release();
                return res.json(responseData)
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



/** 구매목록 체크
 POST /user/cart
 1. 전체선택, 전체해제 x (질문)
 2. cartCheckStatus = 0 선택
 3. cartCheckStatus = 1 선택취소
 **/
exports.getCheckCartProduct = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;

    const productIdx = req.body.productIdx;
    const cartCheckStatus = req.body.cartCheckStatus;
    const productColorIdx = req.body.productColorIdx;
    const productSizeIdx = req.body.productSizeIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            // 예외처리
            const cartExistQuery = `select exists(select userIdx, productIdx from cart where userIdx = ? and productIdx = ?) exist;`;
            const cartExistParams = [userIdx, productIdx];
            const [cartExistResult] = await connection.query(cartExistQuery, cartExistParams);
            if (!cartExistResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 400, "상품이 존재하지 않습니다."));
            }
            /** 체크(o) **/
            if (cartCheckStatus === 0) {
                /** 수량/색상/사이즈 **/
                const existCartCheckStatusColorSizeQuery = `select exists(select userIdx, productIdx, productColorIdx, productSizeIdx from cart where userIdx = ? and productIdx = ? and productColorIdx = ? and productSizeIdx = ?) exist;`;
                const existCartCheckStatusColorSizeParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
                const [existCartCheckStatusColorSizeResult] = await connection.query(existCartCheckStatusColorSizeQuery, existCartCheckStatusColorSizeParams);
                if (existCartCheckStatusColorSizeResult[0].exist === 1) {
                    const updateCartCheckStatusColorSizeQuery = `update cart set cartCheckStatus = 0 where userIdx = ? and productIdx = ? and productColorIdx = ? and productSizeIdx = ?;`;
                    const updateCartCheckStatusColorSizeParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
                    const [updateCartCheckStatusColorSizeResult] = await connection.query(updateCartCheckStatusColorSizeQuery, updateCartCheckStatusColorSizeParams);

                    let responseData = {};
                    responseData = resApi(true, 100, "색상/수량/사이즈 체크(o)");
                    responseData.result = updateCartCheckStatusColorSizeResult;
                    connection.release();
                    return res.json(responseData);
                } else if (existCartCheckStatusColorSizeResult[0].exist === 0) {
                    connection.release();
                    return res.json(resApi(false, 300, "선택한 (색상/사이즈/수량) 제품이 없습니다."));
                }

                /** 수량/색상 **/
                const existCartCheckStatusColorQuery = `select exists(select userIdx, productIdx, productColorIdx from cart where userIdx = ? and productIdx = ? and productColorIdx = ?) exist;`;
                const existCartCheckStatusColorParams = [userIdx, productIdx, productColorIdx];
                const [existCartCheckStatusColorResult] = await connection.query(existCartCheckStatusColorQuery, existCartCheckStatusColorParams);
                if (existCartCheckStatusColorResult[0].exist === 1) {
                    const updateCartCheckStatusColorQuery = `update cart set cartCheckStatus = 0 where userIdx = ? and productIdx = ? and productColorIdx = ?;`;
                    const updateCartCheckStatusColorParams = [userIdx, productIdx, productColorIdx];
                    const [updateCartCheckStatusColorResult] = await connection.query(updateCartCheckStatusColorQuery, updateCartCheckStatusColorParams);

                    let responseData = {};
                    responseData = resApi(true, 101, "색상/수량 체크(o)");
                    responseData.result = updateCartCheckStatusColorResult;
                    connection.release();
                    return res.json(responseData);
                } else if (existCartCheckStatusColorResult[0].exist === 0) {
                    connection.release();
                    return res.json(resApi(false, 301, "선택한 (색상/수량) 제품이 없습니다."));
                }

                /** 수량 **/
                const existCartCheckStatusQuery = `select exists(select userIdx, productIdx from cart where userIdx = ? and productIdx = ?) exist;`;
                const existCartCheckStatusParams = [userIdx, productIdx];
                const [existCartCheckStatusResult] = await connection.query(existCartCheckStatusQuery, existCartCheckStatusParams);
                if (existCartCheckStatusResult[0].exist === 1) {
                    const updateCartCheckStatusQuery = `update cart set cartCheckStatus = 0 where userIdx = ? and productIdx = ?;`;
                    const updateCartCheckStatusParams = [userIdx, productIdx];
                    const [updateCartCheckStatusResult] = await connection.query(updateCartCheckStatusQuery, updateCartCheckStatusParams);

                    let responseData = {};
                    responseData = resApi(true, 102, "수량 체크(o)");
                    responseData.result = updateCartCheckStatusResult;
                    connection.release();
                    return res.json(responseData);
                } else if (existCartCheckStatusColorResult[0].exist === 0) {
                    connection.release();
                    return res.json(resApi(false, 302, "선택한 제품이 없습니다."));
                }
            }

            /** 체크(x) **/
            if (cartCheckStatus === 1) {
                /** 수량/색상/사이즈 **/
                const existCartNoCheckStatusColorSizeQuery = `select exists(select userIdx, productIdx, productColorIdx, productSizeIdx from cart where userIdx = ? and productIdx = ? and productColorIdx = ? and productSizeIdx = ?) exist;`;
                const existCartNoCheckStatusColorSizeParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
                const [existCartNoCheckStatusColorSizeResult] = await connection.query(existCartNoCheckStatusColorSizeQuery, existCartNoCheckStatusColorSizeParams);
                if (existCartNoCheckStatusColorSizeResult[0].exist === 1) {
                    const updateCartNoCheckStatusColorSizeQuery = `update cart set cartCheckStatus = 1 where userIdx = ? and productIdx = ? and productColorIdx = ? and productSizeIdx = ?;`;
                    const updateCartNoCheckStatusColorSizeParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
                    const [updateCartNoCheckStatusColorSizeResult] = await connection.query(updateCartNoCheckStatusColorSizeQuery, updateCartNoCheckStatusColorSizeParams);

                    let responseData = {};
                    responseData = resApi(true, 200, "색상/수량/사이즈 체크(x)");
                    responseData.result = updateCartNoCheckStatusColorSizeResult;
                    connection.release();
                    return res.json(responseData);
                } else if (existCartNoCheckStatusColorSizeResult[0].exist === 0) {
                    connection.release();
                    return res.json(resApi(false, 300, "선택한 (색상/사이즈/수량) 제품이 없습니다."));
                }

                /** 수량/색상 **/
                const existCartNoCheckStatusColorQuery = `select exists(select userIdx, productIdx, productColorIdx from cart where userIdx = ? and productIdx = ? and productColorIdx = ?) exist;`;
                const existCartNoCheckStatusColorParams = [userIdx, productIdx, productColorIdx];
                const [existCartNoCheckStatusColorResult] = await connection.query(existCartNoCheckStatusColorQuery, existCartNoCheckStatusColorParams);
                if (existCartNoCheckStatusColorResult[0].exist === 1) {
                    const updateCartNoCheckStatusColorQuery = `update cart set cartCheckStatus = 1 where userIdx = ? and productIdx = ? and productColorIdx = ?;`;
                    const updateCartNoCheckStatusColorParams = [userIdx, productIdx, productColorIdx];
                    const [updateCartNoCheckStatusColorResult] = await connection.query(updateCartNoCheckStatusColorQuery, updateCartNoCheckStatusColorParams);

                    let responseData = {};
                    responseData = resApi(true, 201, "색상/수량 체크(x)");
                    responseData.result = updateCartNoCheckStatusColorResult;
                    connection.release();
                    return res.json(responseData);
                } else if (existCartNoCheckStatusColorSizeResult[0].exist === 0) {
                    connection.release();
                    return res.json(resApi(false, 301, "선택한 (색상/수량) 제품이 없습니다."));
                }

                /** 수량 **/
                const existCartNoCheckStatusQuery = `select exists(select userIdx, productIdx from cart where userIdx = ? and productIdx = ?) exist;`;
                const existCartNoCheckStatusParams = [userIdx, productIdx];
                const [existCartNoCheckStatusResult] = await connection.query(existCartNoCheckStatusQuery, existCartNoCheckStatusParams);
                if (existCartNoCheckStatusResult[0].exist === 1) {
                    const updateCartNoCheckStatusQuery = `update cart set cartCheckStatus = 1 where userIdx = ? and productIdx = ?;`;
                    const updateCartNoCheckStatusParams = [userIdx, productIdx];
                    const [updateCartNoCheckStatusResult] = await connection.query(updateCartNoCheckStatusQuery, updateCartNoCheckStatusParams);

                    let responseData = {};
                    responseData = resApi(true, 202, "수량 체크(x)");
                    responseData.result = updateCartNoCheckStatusResult;
                    connection.release();
                    return res.json(responseData);
                } else if (existCartNoCheckStatusColorSizeResult[0].exist === 0) {
                    connection.release();
                    return res.json(resApi(false, 302, "선택한 제품이 없습니다."));
                }
            }

            /** 모두 체크 **/
            if (cartCheckStatus === 2) {
                const updateCartCheckStatusAllQuery = `update cart set cartCheckStatus = 0 where userIdx = ?;`;
                const [updateCartCheckStatusAllResult] = await connection.query(updateCartCheckStatusAllQuery, userIdx);

                let responseData = {};
                responseData = resApi(true, 103, "모두 체크");
                responseData.result = updateCartCheckStatusAllResult;
                connection.release();
                return res.json(responseData);
            }

            /** 모두 체크 해제 **/
            if (cartCheckStatus === 3) {
                const updateCartAllNoCheckStatusAllQuery = `update cart set cartCheckStatus = 1 where userIdx = ?;`;
                const [updateCartAllNoCheckStatusAllResult] = await connection.query(updateCartAllNoCheckStatusAllQuery, userIdx);

                let responseData = {};
                responseData = resApi(true, 203, "모두 체크 해제");
                responseData.result = updateCartAllNoCheckStatusAllResult;
                connection.release();
                return res.json(responseData);
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


/** 구매목록 체크된 것 삭제
 DELETE /user/:productIdx/cart
 **/
exports.deleteCheckCartProduct = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const productIdx = req.params.productIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            // 예외처리
            const cartExistQuery = `select exists(select userIdx, productIdx from cart where userIdx = ? and productIdx = ?) exist;`;
            const cartExistParams = [userIdx, productIdx];
            const [cartExistResult] = await connection.query(cartExistQuery, cartExistParams);
            console.log(cartExistResult[0].exist);
            if (!cartExistResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 200, "상품이 존재하지 않습니다."));
            }

            /** checkStatus = 0 일때 선택, checkStatus = 1 일 때 취소 **/
            const deleteCartCheckStatusQuery = `delete from cart where userIdx = ? and productIdx = ? and cartCheckStatus = 0;`;
            const deleteCartCheckStatusParams = [userIdx, productIdx];
            const [deleteCartCheckStatusResult] = await connection.query(deleteCartCheckStatusQuery, deleteCartCheckStatusParams);

            let responseData = {};
            responseData = resApi(true, 100, "삭제완료");
            responseData.result = deleteCartCheckStatusResult;
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


/** 장바구니 내역 조회
 GET /user/cart
 UPDATE 2020.11.03(화)
 **/
exports.getCartProduct = async function (req,res) {
    try {
        const userIdx = req.verifiedToken.userIdx;
        const connection = await pool.getConnection(async conn => conn());
        try {
            /** cart에 상품이 없을때 **/
            const existCartQuery = `select exists(select userIdx from cart where userIdx = ?) exist;`;
            const [existCartResult] = await connection.query(existCartQuery, userIdx);
            if (!existCartResult[0].exist) {
                connection.release()
                return res.json(resApi(false, 200, "장바구니에 상품이 존재하지 않습니다."));
            }

            /** 선택한 삭제 개수 **/
            const deleteCartCheckStatusCountQuery = `select count(cartCheckStatus) deleteCartCheckStatusCount from cart where userIdx = ? and cartCheckStatus = 0;`;
            const deleteCartCheckStatusCountParams = [userIdx];
            const [deleteCartCheckStatusCountResult] = await connection.query(deleteCartCheckStatusCountQuery, deleteCartCheckStatusCountParams);

            /** 구매목록에 담은것 **/
            const selectCartQuery = `select P.productIdx, concat('내일 ', month(now()),'/', day(now() + 2), ' 도착 예정') as productArriveDate, P.productImgUrl, P.productName, OC.productColor, OS.productSize, C.productTotalPrice, C.productCount, P.productCoupangStatus
                                        from cart C
                                        left join product P
                                        on C.productIdx = P.productIdx
                                        left join optionColor OC
                                        on OC.productColorIdx = C.productColorIdx and C.productIdx  = OC.productIdx
                                        left join optionSize OS
                                        on OS.productSizeIdx = C.productSizeIdx and OS.productIdx = C.productIdx
                                        where C.userIdx = ?;`;
            const [selectCartResult] = await connection.query(selectCartQuery, userIdx);


            /** 체크가 되있는 구매 총 개수 **/
            const purchaseCheckCartCountQuery = `select count(cartCheckStatus) purchaseCheckCartCount from cart where userIdx = ? and cartCheckStatus = 0;`;
            const [purchaseCheckCartCountResult] = await connection.query(purchaseCheckCartCountQuery, userIdx);

            /** 체크가 되있는 총 구매 합 **/
            const totalCheckPriceQuery = `select sum(productTotalPrice) as checkTotalPrice from cart where userIdx = ? and cartCheckStatus = 0;`;
            const [totalCheckPriceResult] = await connection.query(totalCheckPriceQuery, userIdx);
            console.log(totalCheckPriceResult[0].checkTotalPrice);
            if (totalCheckPriceResult[0].checkTotalPrice === null) {
                connection.release();
                totalCheckPriceResult[0].checkTotalPrice = 0;
            }

            let responseData = {};
            responseData = resApi(true, 100, "장바구니조회");
            responseData.deleteCheckCartCount = deleteCartCheckStatusCountResult;
            responseData.cartResult = selectCartResult;
            responseData.totalCheckPrice = totalCheckPriceResult;
            responseData.purchaseCheckCartCount = purchaseCheckCartCountResult;
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