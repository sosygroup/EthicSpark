package org.ethicsaware.catalogue.service;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;

/** Includes the full synchronous model request, even if its response has been cancelled in the UI. */
@Component
public class WorkspaceMaintenanceFilter extends OncePerRequestFilter {
    private final WorkspaceMaintenance maintenance;
    public WorkspaceMaintenanceFilter(WorkspaceMaintenance maintenance) {this.maintenance=maintenance;}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        String path=request.getRequestURI();boolean tracked=path.startsWith("/api/")&&!path.startsWith("/api/assistant/maintenance")&&!request.getMethod().equals("GET")&&!request.getMethod().equals("HEAD");
        if(!tracked){chain.doFilter(request,response);return;}
        try {maintenance.enterRequest();}catch(ResponseStatusException e){response.setStatus(409);response.setContentType("application/problem+json");response.getWriter().write("{\"status\":409,\"detail\":\"Workspace reset is in progress. Wait and reload the app.\"}");return;}
        try {chain.doFilter(request,response);}finally{maintenance.leaveRequest();}
    }
}
