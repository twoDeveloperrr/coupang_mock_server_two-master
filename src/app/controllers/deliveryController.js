const {pool} = require('../../../config/database');
const {logger} = require('../../../config/winston');
const resApi = require('../../../config/functions');

const regexName = /^[가-힣]{2,4}$/;
const regexPhone =  /^\d{3}-\d{3,4}-\d{4}$/;

/** 배송지 추가
 POST /user/delivery
 UPDATE 2020.11.06(금)
 **/
exports.postOrderDelivery = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const userReceiveName = req.body.userReceiveName;
    const userAddress = req.body.userAddress;
    const userReceivePhone = req.body.userReceivePhone;
    const deliveryRequest = req.body.deliveryRequest;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            if (!userReceiveName) {
                connection.release();
                return res.json(resApi(false, 300, "받는 사람 이름을 정확히 입력해주세요."));
            }
            if (!userReceivePhone) {
                connection.release();
                return res.json(resApi(false, 301, "휴대폰 번호를 입력해주세요."));
            }
            /** 받는사람 이름 정규식 **/
            if (!regexName.test(userReceiveName)) {
                connection.release();
                return res.json(resApi(false,302, "이름을 정확히 입력하세요."));
            }

            /** 받는사람 핸드폰 정규식 **/
            if (!regexPhone.test(userReceivePhone)){
                connection.release();
                return res.json(resApi(false, 303, "국내 휴대폰 번호만 가능합니다."));
            }
            /** 이미 유저의 배송지가 존재하면 deliveryRow 저장순 나열 **/
            const selectDeliveryUserQuery = `select exists(select userIdx from delivery where userIdx = ?) exist`;
            const [selectDeliveryUserResult] = await connection.query(selectDeliveryUserQuery, userIdx);
            if (selectDeliveryUserResult[0].exist === 1) {
                /** Query Tip
                 1. 서브쿼리를 넣어줘야 한다.
                 2. 이름을 붙혀줘야 한다.
                 **/
                const insertDeliveryRowQuery = `insert into delivery (userIdx, userReceiveName, userAddress, userReceivePhone, deliveryRequest, deliveryRow)
                                                    values (?,?,?,?,?,
                                                            (select deliveryRow from
                                                                (select deliveryRow 
                                                                    from delivery
                                                                    where userIdx = ?
                                                                    order by createdAt
                                                                     desc limit 1) deliveryRow) + 1);`;
                const insertDeliveryRowParams = [userIdx, userReceiveName, userAddress, userReceivePhone, deliveryRequest, userIdx];
                const [insertDeliveryRowResult] = await connection.query(insertDeliveryRowQuery, insertDeliveryRowParams);

                let responseData = {};
                responseData = resApi(true, 101, "deliveryRow 증가");
                responseData.result = insertDeliveryRowResult;
                connection.release();
                return res.json(responseData);
            }

            /** 베송지 정보 담기(받는사람, 배송지, 받는사람 폰번호) **/
            const insertDeliveryQuery = `insert into delivery (userIdx, userReceiveName, userAddress, userReceivePhone, deliveryRequest) values (?,?,?,?,?);`;
            const insertDeliveryParams = [userIdx, userReceiveName, userAddress, userReceivePhone, deliveryRequest];
            const [insertDeliveryResult] = await connection.query(insertDeliveryQuery, insertDeliveryParams);

            let responseData = {};
            responseData = resApi(true, 100, "배송지추가");
            responseData.result = insertDeliveryResult;
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



/** 배송지 가져오기
 GET /user/:userIdx/delivery/management
 UPDATE 2020.11.06(금)
 **/
exports.getOrderDelivery = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            /** 사용자가 입력해놓은 배송목록이 존재하지 않을 때 **/
            const deliveryExistQuery = `select exists(select userIdx from delivery where userIdx = ?) exist;`;
            const [deliveryExistResult] = await connection.query(deliveryExistQuery, userIdx);
            if (!deliveryExistResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 300, "배송지가 존재하지 않습니다."));
            }

            /** 사용자 배송지 목록 조회 **/
            const selectDeliveryQuery = `select userReceiveName, userAddress, userReceivePhone, deliveryRequest from delivery where userIdx = ?;`;
            const [selectDeliveryResult] = await connection.query(selectDeliveryQuery, userIdx);

            let responseData = {};
            responseData = resApi(true, 100, "배송지조회");
            responseData.result = selectDeliveryResult;
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

/** 배송지 수정
 PATCH /user/:userIdx/delivery/:deliveryRow
 UPDATE 2020.11.06(금)
 **/
exports.patchOrderDelivery = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const deliveryRow = req.params.deliveryRow;

    const userReceiveName = req.body.userReceiveName;
    const userAddress = req.body.userAddress;
    const userReceivePhone = req.body.userReceivePhone;
    const deliveryRequest = req.body.deliveryRequest;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            if (!userReceiveName) {
                connection.release();
                return res.json(resApi(false, 300, "받는 사람 이름을 정확히 입력해주세요."));
            }
            if (!userReceivePhone) {
                connection.release();
                return res.json(resApi(false, 301, "휴대폰 번호를 입력해주세요."));
            }
            /** 받는사람 이름 정규식 **/
            if (!regexName.test(userReceiveName)) {
                connection.release();
                return res.json(resApi(false,302, "이름을 정확히 입력하세요."));
            }

            /** 받는사람 핸드폰 정규식 **/
            if (!regexPhone.test(userReceivePhone)){
                connection.release();
                return res.json(resApi(false, 303, "국내 휴대폰 번호만 가능합니다."));
            }
            const deliveryExistQuery = `select exists(select userIdx, deliveryRow from delivery where userIdx = ? and deliveryRow = ?) exist;`;
            const deliveryExistParams = [userIdx, deliveryRow];
            const [deliveryExistResult] = await connection.query(deliveryExistQuery, deliveryExistParams);
            if (!deliveryExistResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 304, "배송지가 존재하지 않습니다."));
            }

            /** 배송지 정보 담기(받는사람, 배송지, 받는사람 폰번호) **/
            const updateDeliveryQuery = `update delivery
                                            set userReceiveName = ?, userAddress = ?, userReceivePhone = ?, deliveryRequest = ?
                                            where userIdx =? and deliveryRow = ?;`;
            const updateDeliveryParams = [userReceiveName, userAddress, userReceivePhone, deliveryRequest, userIdx, deliveryRow];
            const [updateDeliveryResult] = await connection.query(updateDeliveryQuery, updateDeliveryParams);

            let responseData = {};
            responseData = resApi(true, 100, "배송지수정");
            responseData.result = updateDeliveryResult;
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


/** 배송지 삭제
 DELETE /user/:userIdx/delivery/:deliveryRow
 UPDATE 2020.11.06(금)
 **/
exports.deleteOrderDelivery = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const deliveryRow = req.params.deliveryRow;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            const deliveryExistQuery = `select exists(select userIdx, deliveryRow from delivery where userIdx = ? and deliveryRow = ?) exist;`;
            const deliveryExistParams = [userIdx, deliveryRow];
            const [deliveryExistResult] = await connection.query(deliveryExistQuery, deliveryExistParams);
            if (!deliveryExistResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 304, "배송지가 존재하지 않습니다."));
            }

            /** 배송지 목록 삭제 **/
            const deleteDeliveryQuery = `delete from delivery
                                            where userIdx = ? and deliveryRow = ?;`;
            const deleteDeliveryParams = [userIdx, deliveryRow];
            const [deleteDeliveryResult] = await connection.query(deleteDeliveryQuery, deleteDeliveryParams);

            let responseData = {};
            responseData = resApi(true, 100, "배송지삭제");
            responseData.result = deleteDeliveryResult;
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

/** 기본배송지 설정
 POST /user/delivery/check
 UPDATE 2020.11.09(월)
 1. deliveryCheckStatus = 0 이면 '기본배송지'
 2. deliveryRow -> 여러 배송지중 선택지
 **/
exports.postOrderCheckDelivery = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const deliveryRow = req.body.deliveryRow;
    const deliveryCheckStatus = req.body.deliveryCheckStatus
    try {

        const connection = await pool.getConnection(async conn => conn());
        try {
            const deliveryExistQuery = `select exists(select userIdx, deliveryRow from delivery where userIdx = ? and deliveryRow = ?) exist;`;
            const deliveryExistParams = [userIdx, deliveryRow];
            const [deliveryExistResult] = await connection.query(deliveryExistQuery, deliveryExistParams);
            if (!deliveryExistResult[0].exist) {
                connection.release();
                return res.json(resApi(false, 304, "배송지가 존재하지 않습니다."));
            }

            const updateDeliveryCheckStatusQuery = `update delivery set deliveryCheckStatus = 1 where userIdx = ?`;
            const updateDeliveryCheckStatusParams = [userIdx, deliveryRow];
            const [updateDeliveryCheckStatusResult] = await connection.query(updateDeliveryCheckStatusQuery, updateDeliveryCheckStatusParams);
            connection.release();

            if (deliveryCheckStatus === 0) {
                const updateDeliveryCheckStatusQuery = `update delivery set deliveryCheckStatus = 0 where userIdx = ? and deliveryRow = ?;`;
                const updateDeliveryCheckStatusParams = [userIdx, deliveryRow];
                const [updateDeliveryCheckStatusResult] = await connection.query(updateDeliveryCheckStatusQuery, updateDeliveryCheckStatusParams);

                let responseData = {};
                responseData = resApi(true, 100, "기본배송지 설정");
                responseData.result = updateDeliveryCheckStatusResult;
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
