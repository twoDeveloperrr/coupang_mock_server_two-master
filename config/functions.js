function responseFormat(isSuccess,code,message){
    let responseData = {};
    responseData.isSuccess = isSuccess;
    responseData.code = code;//200
    responseData.message = message;

    return responseData;
}


module.exports = responseFormat;

