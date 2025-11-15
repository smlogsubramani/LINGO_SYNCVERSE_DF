import Cookies from 'js-cookie';
import { client, logger } from '../server/DF/sdk';

// authService.tsx
export const login = async (authenticationRequest: any) => {
    try {
        const response = await client.getAuthService().login(authenticationRequest);
 
        if (process.env.REACT_APP_DF_TENANT_ID === response.Result.TenantID) {
            if (response.StatusCode === 200) {
                // Store the complete user data structure from Diligence Fabric
                const userData = {
                    FirstName: response.Result.FirstName,
                    LastName: response.Result.LastName,
                    MiddleName: response.Result.MiddleName,
                    UserName: response.Result.UserName,
                    EmailAddress: response.Result.EmailAddress,
                    Roles: response.Result.Roles,
                    TenantName: response.Result.TenantName,
                    TenantID: response.Result.TenantID,
                    Token: response.Result.Token,
                    UserID: response.Result.UserID,
                    // Include other fields as needed
                };
                
                localStorage.setItem('userData', JSON.stringify(userData));
                
                if (authenticationRequest.rememberMe === 'on') {
                    Cookies.set('df_ds_rem_user', authenticationRequest.username, { expires: 7 });
                }
                return { status: 'SUCCESS', response, message: 'Login Successful!' };
            } else {
                const result: any = response.Result;
                return { status: 'ERROR', message: result?.Status };
            }
        } else {
            return {
                status: 'ERROR',
                message: `${authenticationRequest.username} is associated with a different Tenant/Application.`,
            };
        }
    } catch (error: any) {
        logger.log('Error', 'Login', 'Login Response Error: ' + JSON.stringify(error));
        return { status: 'ERROR', message: error.body.Result?.ErrorMessage };
    }
};
