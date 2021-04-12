const {pool} = require('../../../config/database');
const {logger} = require('../../../config/winston');
const resApi = require('../../../config/functions');
const cron = require('node-cron');


/** 결제화면(장바구니)
 GET /cart/order
 UPDATE 2020.11.06(금)
 장바구니에 있는 목록 -> 결제진행창
 **/
exports.getOrder = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            await connection.beginTransaction();

            /** 구매자 정보 **/
            const selectUserQuery = `select userName, userEmail, userPhone from user where userIdx = ?;`;
            const [selectUserResult] = await connection.query(selectUserQuery, userIdx);
            connection.release();

            /** 배송지 정보 **/
            const selectDeliveryQuery = `select userReceiveName, userAddress, userReceivePhone from delivery where userIdx =? and deliveryCheckStatus = 0;`;
            const [selectDeliveryResult] = await connection.query(selectDeliveryQuery, userIdx);
            connection.release();

            /** 배송 요청 사항 **/
            const selectDeliveryRequestQuery = `select deliveryRequest from delivery where userIdx = ? and deliveryCheckStatus = 0;`;
            const [selectDeliveryRequestResult] = await connection.query(selectDeliveryRequestQuery, userIdx);
            connection.release();

            /** 구매목록에 담은것 **/
            const selectCartQuery = `select P.productIdx, P.productName, OC.productColor, OS.productSize, C.productCount, concat('모레', month(now()),'/', day(now() + 2), ' 도착 예정') as productArriveDate ,P.productCoupangStatus
                                        from cart C
                                        left join product P
                                        on C.productIdx = P.productIdx
                                        left join optionColor OC
                                        on OC.productColorIdx = C.productColorIdx and C.productIdx = OC.productIdx
                                        left join optionSize OS
                                        on OS.productSizeIdx = C.productSizeIdx and C.productIdx = OS.productIdx
                                        where C.userIdx = ? and C.cartCheckStatus = 0;`;
            const [selectCartResult] = await connection.query(selectCartQuery, userIdx);
            connection.release();

            /** 체크가 되있는 총 구매 합 **/
            const totalCheckPriceQuery = `select sum(productTotalPrice) as checkTotalPrice,
                                            case
                                                when sum(productTotalPrice) > 19800 then '로켓배송'
                                                when sum(productTotalPrice) < 19800 then sum(productTotalPrice) + 2500
                                            end deliveryFee
                                             from cart
                                              where userIdx = ? and cartCheckStatus = 0;`;
            const [totalCheckPriceResult] = await connection.query(totalCheckPriceQuery, userIdx);
            console.log(totalCheckPriceResult[0].checkTotalPrice);
            if (totalCheckPriceResult[0].checkTotalPrice === null) {
                connection.release();
                totalCheckPriceResult[0].checkTotalPrice = 0;
            }
            await connection.commit();
            let responseData = {};
            responseData = resApi(true, 100, "결제진행(장바구니)");
            responseData.userResult = selectUserResult;
            responseData.deliveryResult = selectDeliveryResult;
            responseData.deliveryRequestResult = selectDeliveryRequestResult;
            responseData.cartResult = selectCartResult;
            responseData.totalCheckPrice = totalCheckPriceResult;
            connection.release();
            return res.json(responseData);
        } catch (err) {
            await connection.rollback(); // ROLLBACK
            connection.release();
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};

/** 주문/결제(장바구니)
 POST /cart/order
 추가되면서 장바구니에 존재하는 값은 삭제되게끔
 orderStatus = 0 -> 결제 진행중(무통장)/ 1 -> 바로 결제(신용카드 등)
 **/
exports.postOrderCart = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;

    const orderStatus = req.body.orderStatus;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            await connection.beginTransaction();
            const existProductCartQuery = `select exists(select userIdx, productIdx from cart where userIdx = ? and cartCheckStatus = 0) exist;`;
            const [existProductCartResult] = await connection.query(existProductCartQuery, userIdx);
            if (!existProductCartResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 300, "장바구니에 선택한 상품이 없습니다."));
            }
            const selectCartQuery = `select productIdx, productColorIdx, productSizeIdx, productCount, productTotalPrice from cart where userIdx= ?;`;
            const selectCartParams = [userIdx];
            const [selectCartResult] = await connection.query(selectCartQuery, selectCartParams);

            /** 1. 장바구니에서 구매할 상품 OrderInfo에 추가 **/
            //orderStatus = 0(아직 입금이 안된 상품)
                if(orderStatus === 0) {
                    const insertOrderInfoCartQuery = `Insert into orderInfo (userIdx, productIdx, productColorIdx, productSizeIdx, orderCount, orderTotalPrice)
                                                select userIdx, productIdx, productColorIdx, productSizeIdx, productCount, productTotalPrice
                                                from cart
                                                where userIdx = ? and cartCheckStatus = 0;`;
                    const insertOrderInfoCartParams = [userIdx];
                    const [insertOrderInfoCartResult] = await connection.query(insertOrderInfoCartQuery, insertOrderInfoCartParams);

                    const updateOrderStatusQuery = `update orderInfo set orderStatus = 0;`;
                    const [updateOrderStatusResult] = await connection.query(updateOrderStatusQuery);

                    /** 주문이된 장바구니 상품은 삭제 **/
                    const deleteCartQuery = `delete from cart where userIdx = ? and cartCheckStatus = 0;`;
                    const [deleteCartResult] = await connection.query(deleteCartQuery, userIdx);

                    let responseData = {};
                    responseData = resApi(true, 100, "주문/결제(장바구니)");
                    responseData.selectCartResult = selectCartResult;
                    responseData.insertOrderInfoCartResult = insertOrderInfoCartResult;
                    responseData.updateOrderStatusResult = updateOrderStatusResult;
                    responseData.deleteCartResult = deleteCartResult;
                    await connection.commit();
                    connection.release();
                    return res.json(responseData);
                }
                //orderStatus = 1(바로 입금 완료된 상품)
                if (orderStatus === 1) {
                    const insertOrderInfoCartQuery = `Insert into orderInfo (userIdx, productIdx, productColorIdx, productSizeIdx, orderCount, orderTotalPrice)
                                                select userIdx, productIdx, productColorIdx, productSizeIdx, productCount, productTotalPrice
                                                from cart
                                                where userIdx = ? and cartCheckStatus = 0;`;
                    const insertOrderInfoCartParams = [userIdx];
                    const [insertOrderInfoCartResult] = await connection.query(insertOrderInfoCartQuery, insertOrderInfoCartParams);

                    const updateOrderStatusQuery = `update orderInfo set orderStatus = 1;`;
                    const [updateOrderStatusResult] = await connection.query(updateOrderStatusQuery);

                    /** 주문이된 장바구니 상품은 삭제 **/
                    const deleteCartQuery = `delete from cart where userIdx = ? and cartCheckStatus = 0;`;
                    const [deleteCartResult] = await connection.query(deleteCartQuery, userIdx);

                    let responseData = {};
                    responseData = resApi(true, 100, "주문/결제(장바구니)");
                    responseData.selectCartResult = selectCartResult;
                    responseData.insertOrderInfoCartResult = insertOrderInfoCartResult;
                    responseData.updateOrderStatusResult = updateOrderStatusResult;
                    responseData.deleteCartResult = deleteCartResult;
                    await connection.commit();
                    connection.release();
                    return res.json(responseData);
                }
        } catch (err) {
            await connection.rollback();
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};


/** 주문/결제(바로)
 * 바로구매 결제창 -> Payment로 값이 저장
 POST /product/:productIdx/order
 **/
exports.postOrderPayment = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const productIdx = req.params.productIdx;

    const productSizeIdx = req.body.productSizeIdx;
    const productColorIdx = req.body.productColorIdx;
    const productCount = req.body.productCount;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            /** 구매자 정보 **/
            const selectUserQuery = `select userName, userEmail, userPhone from user where userIdx = ?;`;
            const [selectUserResult] = await connection.query(selectUserQuery, userIdx);
            connection.release();

            /** 배송지 정보 **/
            const selectDeliveryQuery = `select userReceiveName, userAddress, userReceivePhone from delivery where userIdx =? and deliveryCheckStatus = 0;`;
            const [selectDeliveryResult] = await connection.query(selectDeliveryQuery, userIdx);
            connection.release();

            /** 배송 요청 사항 **/
            const selectDeliveryRequestQuery = `select deliveryRequest from delivery where userIdx = ? and deliveryCheckStatus = 0;`;
            const [selectDeliveryRequestResult] = await connection.query(selectDeliveryRequestQuery, userIdx);
            connection.release();

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

                const insertPaymentQuery = `insert into payment (userIdx, productIdx, productColorIdx, productSizeIdx, productCount, productTotalPrice) values (?,?,?,?,?,? * (select productPrice from (select productPrice from product where productIdx = ?) productPrice));`;
                const insertPaymentParams = [userIdx, productIdx, productColorIdx, productSizeIdx,  productCount, productCount, productIdx];
                const [insertPaymentResult] = await connection.query(insertPaymentQuery, insertPaymentParams);

                const selectCartQuery = `select P.productIdx, P.productName, OC.productColor, OS.productSize, PA.productCount, concat('내일', month(now()),'/', day(now() + 2), ' 도착 예정') as productArriveDate ,P.productCoupangStatus
                                        from payment PA
                                        left join product P
                                        on PA.productIdx = P.productIdx
                                        left join optionColor OC
                                        on OC.productColorIdx = PA.productColorIdx and PA.productIdx = OC.productIdx
                                        left join optionSize OS
                                        on OS.productSizeIdx = PA.productSizeIdx and PA.productIdx = OS.productIdx
                                        where PA.userIdx = ?
                                        order by PA.paymentIdx desc
                                        limit 1;`;
                const [selectCartResult] = await connection.query(selectCartQuery, userIdx);

                const totalCheckPriceQuery = `select sum(productTotalPrice) as checkTotalPrice,
                                            case
                                                when sum(productTotalPrice) > 19800 then '로켓배송'
                                                when sum(productTotalPrice) < 19800 then sum(productTotalPrice) + 2500
                                            end deliveryFee
                                             from payment
                                              where userIdx = ?;`;
                const [totalCheckPriceResult] = await connection.query(totalCheckPriceQuery, userIdx);
                console.log(totalCheckPriceResult[0].checkTotalPrice);
                if (totalCheckPriceResult[0].checkTotalPrice === null) {
                    connection.release();
                    totalCheckPriceResult[0].checkTotalPrice = 0;
                }


                let responseData = {};
                responseData = resApi(true, 101, "주문/결제(바로구매)");
                responseData.result = insertPaymentResult;
                responseData.userResult = selectUserResult;
                responseData.deliveryResult = selectDeliveryResult;
                responseData.deliveryRequestResult = selectDeliveryRequestResult;
                responseData.cartResult = selectCartResult;
                responseData.totalCheckPrice = totalCheckPriceResult;
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
                const insertOrderInfoQuery = `insert into payment (userIdx, productIdx, productColorIdx, productCount, productTotalPrice) values (?,?,?,?,? * (select productPrice from (select productPrice from product where productIdx = ?) productPrice));`;
                const insertOrderInfoParams = [userIdx, productIdx, productColorIdx, productCount, productCount, productIdx];
                const [insertOrderInfoResult] = await connection.query(insertOrderInfoQuery, insertOrderInfoParams);

                const selectCartQuery = `select P.productIdx, P.productName, OC.productColor, OS.productSize, PA.productCount, concat('내일', month(now()),'/', day(now() + 2), ' 도착 예정') as productArriveDate ,P.productCoupangStatus
                                        from payment PA
                                        left join product P
                                        on PA.productIdx = P.productIdx
                                        left join optionColor OC
                                        on OC.productColorIdx = PA.productColorIdx and PA.productIdx = OC.productIdx
                                        left join optionSize OS
                                        on OS.productSizeIdx = PA.productSizeIdx and PA.productIdx = OS.productIdx
                                        where PA.userIdx = ?
                                        order by PA.paymentIdx desc
                                        limit 1;`;
                const [selectCartResult] = await connection.query(selectCartQuery, userIdx);

                const totalCheckPriceQuery = `select sum(productTotalPrice) as checkTotalPrice,
                                            case
                                                when sum(productTotalPrice) > 19800 then '로켓배송'
                                                when sum(productTotalPrice) < 19800 then sum(productTotalPrice) + 2500
                                            end deliveryFee
                                             from payment
                                              where userIdx = ?;`;
                const [totalCheckPriceResult] = await connection.query(totalCheckPriceQuery, userIdx);
                console.log(totalCheckPriceResult[0].checkTotalPrice);
                if (totalCheckPriceResult[0].checkTotalPrice === null) {
                    connection.release();
                    totalCheckPriceResult[0].checkTotalPrice = 0;
                }

                let responseData = {};
                responseData = resApi(true, 101, "주문/결제(바로구매)");
                responseData.result = insertOrderInfoResult;
                responseData.userResult = selectUserResult;
                responseData.deliveryResult = selectDeliveryResult;
                responseData.deliveryRequestResult = selectDeliveryRequestResult;
                responseData.cartResult = selectCartResult;
                responseData.totalCheckPrice = totalCheckPriceResult;
                connection.release();
                return res.json(responseData)
            }

            /** 1. 수량 새로 추가 **/
            if (productOptionResult[0].productOptionStatus === 1) {
                const insertOrderInfoQuery = `insert into payment (userIdx, productIdx, productCount, productTotalPrice) values (?,?,?,? * (select productPrice from (select productPrice from product where productIdx = ?) productPrice));`;
                const insertOrderInfoParams = [userIdx, productIdx, productCount, productCount, productIdx];
                const [insertOrderInfoResult] = await connection.query(insertOrderInfoQuery, insertOrderInfoParams);

                const selectCartQuery = `select P.productIdx, P.productName, OC.productColor, OS.productSize, PA.productCount, concat('모레', month(now()),'/', day(now() + 2), ' 도착 예정') as productArriveDate ,P.productCoupangStatus
                                        from payment PA
                                        left join product P
                                        on PA.productIdx = P.productIdx
                                        left join optionColor OC
                                        on OC.productColorIdx = PA.productColorIdx and PA.productIdx = OC.productIdx
                                        left join optionSize OS
                                        on OS.productSizeIdx = PA.productSizeIdx and PA.productIdx = OS.productIdx
                                        where PA.userIdx = ?
                                        order by PA.paymentIdx desc
                                        limit 1;`;
                const [selectCartResult] = await connection.query(selectCartQuery, userIdx);

                const totalCheckPriceQuery = `select sum(productTotalPrice) as checkTotalPrice,
                                            case
                                                when sum(productTotalPrice) > 19800 then '로켓배송'
                                                when sum(productTotalPrice) < 19800 then sum(productTotalPrice) + 2500
                                            end deliveryFee
                                             from payment
                                              where userIdx = ?;`;
                const [totalCheckPriceResult] = await connection.query(totalCheckPriceQuery, userIdx);
                console.log(totalCheckPriceResult[0].checkTotalPrice);
                if (totalCheckPriceResult[0].checkTotalPrice === null) {
                    connection.release();
                    totalCheckPriceResult[0].checkTotalPrice = 0;
                }

                let responseData = {};
                responseData = resApi(true, 101, "주문/결제(바로구매)");
                responseData.result = insertOrderInfoResult;
                responseData.userResult = selectUserResult;
                responseData.deliveryResult = selectDeliveryResult;
                responseData.deliveryRequestResult = selectDeliveryRequestResult;
                responseData.cartResult = selectCartResult;
                responseData.totalCheckPrice = totalCheckPriceResult;
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

/** 바로결제 취소 **/
exports.deletePayment = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            await connection.beginTransaction();

            const existPaymentQuery = `select exists(select productIdx from payment where userIdx = ?) exist;`;
            const [existPaymentResult] = await connection.query(existPaymentQuery, userIdx);
            if (!existPaymentResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 300, "결제진행창이 존재하지 않습니다."));
            }

            const deletePaymentQuery = `delete from payment where userIdx = ?;`;
            const [deletePaymentResult] = await connection.query(deletePaymentQuery, userIdx);

            await connection.commit();
            let responseData = {};
            responseData = resApi(true, 100, "결제취소");
            responseData.deletePaymentResult = deletePaymentResult;
            connection.release();
            return res.json(responseData);
        } catch (err) {
            await connection.rollback(); // ROLLBACK
            connection.release();
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};


/** 결제(바로)
 POST /product/order
 **/
exports.postOrderProduct = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            await connection.beginTransaction();
            const existPaymentQuery = `select exists(select userIdx, productIdx from payment where userIdx = ?) exist;`;
            const [existPaymentResult] = await connection.query(existPaymentQuery, userIdx);
            if (!existPaymentResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 300, "결제창에 상품이 없습니다."));
            }
            /** 1. 바로 구매할 상품 OrderInfo에 추가 **/
            const insertOrderInfoProductQuery = `Insert into orderInfo (userIdx, productIdx, productColorIdx, productSizeIdx, orderCount, orderTotalPrice)
                                                select userIdx, productIdx, productColorIdx, productSizeIdx, productCount, productTotalPrice
                                                from payment
                                                where userIdx = ?;`;
            const [insertOrderInfoProductResult] = await connection.query(insertOrderInfoProductQuery, userIdx);

            /** payment 삭제 **/
            const deletePaymentQuery = `delete from payment where userIdx = ?;`;
            const [deletePaymentResult] = await connection.query(deletePaymentQuery, userIdx);

            await connection.commit();
            let responseData = {};
            responseData = resApi(true, 100, "결제(바로)");
            responseData.result = insertOrderInfoProductResult;
            connection.release();
            return res.json(responseData);
        } catch (err) {
            await connection.rollback(); // ROLLBACK
            connection.release();
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};

/** 주문 취소
 POST /profile/order
 orderInfo 에서 삭제된 목록 isDeleted 값 -> Y 로 update
 **/
exports.deleteOrder = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;

    const productIdx = req.body.productIdx;
    const productSizeIdx = req.body.productSizeIdx;
    const productColorIdx = req.body.productColorIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            await connection.beginTransaction();
            /** 구매목록 상품 존재 x **/
            const existOrderProductQuery = `select exists(select productIdx from orderInfo where userIdx = ? and productIdx = ?) exist;`;
            const existOrderProductParams = [userIdx, productIdx];
            const [existOrderProductResult] = await connection.query(existOrderProductQuery, existOrderProductParams);
            if (!existOrderProductResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 300, "주문된 상품이 존재하지 않습니다."));
            }

            /** 수량/색상/사이즈 옵션 검색
             * 1. productOptionStatus = 1 -> 수량
             * 2. productOptionStatus = 2 -> 수량/색상
             * 3. productOptionStatus = 3 -> 수량/색상/사이즈
             * **/
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

                const updateOrderInfoQuery = `update orderInfo set isDeleted = 'Y' where userIdx = ? and productIdx = ? and productColorIdx = ? and productSizeIdx =?;`;
                const updateOrderInfoParams = [userIdx, productIdx, productColorIdx, productSizeIdx];
                const [updateOrderInfoResult] = await connection.query(updateOrderInfoQuery, updateOrderInfoParams);

                await connection.commit();
                let responseData = {};
                responseData = resApi(true, 103, "수량/색상/사이즈 주문 취소");
                responseData.result = updateOrderInfoResult;
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
                const updateOrderInfoQuery = `update orderInfo set isDeleted = 'Y' where userIdx = ? and productIdx = ? and productColorIdx = ?;`;
                const updateOrderInfoParams = [userIdx, productIdx, productColorIdx];
                const [updateOrderInfoResult] = await connection.query(updateOrderInfoQuery, updateOrderInfoParams);

                await connection.commit();
                let responseData = {};
                responseData = resApi(true, 102, "수량/색상 주문 취소");
                responseData.result = updateOrderInfoResult;
                connection.release();
                return res.json(responseData)
            }

            /** 1. 수량 새로 삭제 **/
            if (productOptionResult[0].productOptionStatus === 1) {
                const updateOrderInfoQuery = `update orderInfo set isDeleted = 'Y' from orderInfo where userIdx = ? and productIdx = ? ;`;
                const updateOrderInfoParams = [userIdx, productIdx];
                const [updateOrderInfoResult] = await connection.query(updateOrderInfoQuery, updateOrderInfoParams);

                await connection.commit();
                let responseData = {};
                responseData = resApi(true, 101, "주문 취소");
                responseData.result = updateOrderInfoResult;
                connection.release();
                return res.json(responseData)
            }
        } catch (err) {
            await connection.rollback(); // ROLLBACK
            connection.release();
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};

/** 주문목록 조회
 GET /profile/order
 **/
exports.getOrderManagement = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            await connection.beginTransaction();
            /** 구매 목록 정보 **/
            const orderInfoQuery = `select distinct concat(month(O.createdAt),'/',day(O.createdAt)+2, '도착예정') as arriveProductDate, P.productName, OC.productColor, OS.productSize, O.orderCount, O.orderTotalPrice, P.productCoupangStatus,
                                             case
                                                when O.orderTotalPrice > 19800 then '로켓배송'
                                                when O.orderTotalPrice < 19800 then O.orderTotalPrice + 2500
                                            end deliveryFee
                                            from orderInfo O
                                            left join product P
                                            on O.productIdx = P.productIdx
                                            left join optionColor OC
                                            on OC.productColorIdx = O.productColorIdx and OC.productIdx = O.productIdx
                                            left join optionSize OS
                                            on OS.productSizeIdx = O.productSizeIdx and OS.productIdx = O.productIdx
                                            where userIdx = ?;`;
            const [orderInfoResult] = await connection.query(orderInfoQuery, userIdx);

            await connection.commit();
            let responseData = {};
            responseData = resApi(true, 100, "주문목록 조회");
            responseData.userOrderInfoResult = orderInfoResult;
            connection.release();
            return res.json(responseData);
        } catch (err) {
            await connection.rollback(); // ROLLBACK
            connection.release();
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};


/** cron-node를 이용해서 배송상태가 0인 결제 대기중인 것을 5일내에 결제 하지 못하면 주문목록에서 삭제됨
 * delete 하는 것 지향
 * isDeleted 로 테이블을 관리하는 것을 선호 **/
// cron-node를 이용
// cron.schedule(`0 4 */5 * *`) - > 5일마다 실행
// 일단 5분으로 설정
cron.schedule(`0 4 */5 * *`, async function ()  {
    console.log('5일마다 실행');
    const connection = await pool.getConnection(async conn => conn);
    try {
        // insert 쿼리문 시작전에 트랙젝션 시작을 해줍니다.
        await connection.beginTransaction();
        const existDeleteOrderQuery = `select exists(select orderStatus from orderInfo where orderStatus = 0) orderStatus;`;
        const [existDeleteOrderResult] = await connection.query(existDeleteOrderQuery);
        if (existDeleteOrderResult[0].orderStatus === 0) {
            console.log('결제되지 않은 상품이 없습니다.');
            await connection.commit();
            connection.release();
            return;
        }
        const insertCancelOrderQuery = `insert into cancelOrder (userIdx, productIdx, productColorIdx, productSizeIdx, cancelOrderCount, cancelOrderTotalPrice)
                                                select userIdx, productIdx, productColorIdx, productSizeIdx, orderCount, orderTotalPrice
                                                from orderInfo
                                                where orderStatus = 0;`;
        const [insertCancelOrderResult] = await connection.query(insertCancelOrderQuery);

        const updateOrderQuery = `update orderInfo set isDeleted = 'Y' where orderStatus = 0;`;
        const [updateOrderResult] = await connection.query(updateOrderQuery);

        console.log('취소되었습니다.');
        let responseData = {};
        responseData = resApi(true, 100, "주문취소");
        responseData.insertCancelOrderResult = insertCancelOrderResult;
        responseData.deleteOrderResult = updateOrderResult;
        await connection.commit();
        connection.release();
        return;
    } catch (err) {
        await connection.rollback();
        connection.release();
        return;
    }
});

// cron.schedule(`*/1 * * * *`, async function ()  {
//     console.log('5일마다 실행');
//     const connection = await pool.getConnection(async conn => conn);
//     try {
//         // insert 쿼리문 시작전에 트랙젝션 시작을 해줍니다.
//         await connection.beginTransaction();
//         const existDeleteOrderQuery = `select exists(select orderStatus from orderInfo where orderStatus = 0) orderStatus;`;
//         const [existDeleteOrderResult] = await connection.query(existDeleteOrderQuery);
//         if (existDeleteOrderResult[0].orderStatus === 0) {
//             console.log('결제되지 않은 상품이 없습니다.');
//             await connection.commit();
//             connection.release();
//             return;
//         }
//         const insertCancelOrderQuery = `insert into cancelOrder (userIdx, productIdx, productColorIdx, productSizeIdx, cancelOrderCount, cancelOrderTotalPrice)
//                                                 select userIdx, productIdx, productColorIdx, productSizeIdx, orderCount, orderTotalPrice
//                                                 from orderInfo
//                                                 where orderStatus = 0;`;
//         const [insertCancelOrderResult] = await connection.query(insertCancelOrderQuery);
//
//         const deleteOrderQuery = `update orderInfo set isDeleted = 'Y' where orderStatus = 0;`;
//         const [deleteOrderResult] = await connection.query(deleteOrderQuery);
//
//         console.log('취소되었습니다.');
//         let responseData = {};
//         responseData = resApi(true, 100, "주문취소");
//         responseData.insertCancelOrderResult = insertCancelOrderResult;
//         responseData.deleteOrderResult = deleteOrderResult;
//         await connection.commit();
//         connection.release();
//         return;
//     } catch (err) {
//         await connection.rollback();
//         connection.release();
//         return;
//     }
// });

/** 취소목록 조회
 GET /profile/cancel
 **/
exports.getCancelOrderManagement = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            await connection.beginTransaction();
            /** 구매 목록 정보 **/
            const cancelOrderInfoQuery = `select P.productName, OC.productColor, OS.productSize, O.cancelOrderCount, O.cancelOrderTotalPrice, P.productCoupangStatus
                                            from cancelOrder O
                                            left join product P
                                            on O.productIdx = P.productIdx
                                            left join optionColor OC
                                            on OC.productColorIdx = O.productColorIdx and OC.productIdx = O.productIdx
                                            left join optionSize OS
                                            on OS.productSizeIdx = O.productSizeIdx and OS.productIdx = O.productIdx
                                            where O.userIdx = ?;`;
            const [cancelOrderInfoResult] = await connection.query(cancelOrderInfoQuery, userIdx);

            await connection.commit();
            let responseData = {};
            responseData = resApi(true, 100, "주문취소목록 조회");
            responseData.userOrderInfoResult = cancelOrderInfoResult;
            connection.release();
            return res.json(responseData);
        } catch (err) {
            await connection.rollback(); // ROLLBACK
            connection.release();
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};